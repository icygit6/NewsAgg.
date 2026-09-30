"""Internal CPU embedding service. No API keys, public port, or cloud inference."""
import json
import os
import threading
import hashlib
from collections import OrderedDict
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODEL = 'BAAI/bge-m3'
LOCK = threading.Lock()
VECTORS = OrderedDict()

@lru_cache(maxsize=1)
def engine():
    import torch
    from transformers import AutoTokenizer, AutoModel
    torch.set_num_threads(int(os.getenv('AI_CPU_THREADS', '2')))
    return AutoTokenizer.from_pretrained(MODEL), AutoModel.from_pretrained(MODEL).eval()

def embed(texts):
    import torch
    tokenizer, model = engine()
    keys = [hashlib.sha256(text.encode()).hexdigest() for text in texts]
    missing = list(dict.fromkeys((key,text) for key,text in zip(keys,texts) if key not in VECTORS))
    with torch.inference_mode():
        for i in range(0, len(missing), 2):
            batch = missing[i:i+2]
            inputs = tokenizer([text for _,text in batch], padding=True, truncation=True, max_length=512, return_tensors='pt')
            vectors = model(**inputs).last_hidden_state[:, 0]
            for (key,_), vector in zip(batch,torch.nn.functional.normalize(vectors, p=2, dim=1).tolist()):
                VECTORS[key] = vector
    result = [VECTORS[key] for key in keys]
    for key in keys:
        VECTORS.move_to_end(key)
    while len(VECTORS) > 1024:
        VECTORS.popitem(last=False)
    return result

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Never log article text or questions.

    def reply(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        self.reply(200 if self.path == '/health' else 404, {'model': MODEL, 'loaded': engine.cache_info().currsize > 0})

    def do_POST(self):
        if self.path != '/embed':
            return self.reply(404, {'error': 'not_found'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 1000000:
                return self.reply(413, {'error': 'payload_size'})
            payload = json.loads(self.rfile.read(length))
            texts = payload.get('texts') if isinstance(payload, dict) else None
            if not isinstance(texts, list) or not 1 <= len(texts) <= 160 or any(not isinstance(t, str) or len(t) > 6000 for t in texts):
                return self.reply(400, {'error': 'invalid_texts'})
            if not LOCK.acquire(blocking=False):
                return self.reply(503, {'error': 'busy'})
            try:
                self.reply(200, {'model': MODEL, 'embeddings': embed(texts)})
            finally:
                LOCK.release()
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as exc:
            print('Embedding failed:', type(exc).__name__, flush=True)
            self.reply(503, {'error': 'embedding_unavailable'})

if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', 8090), Handler).serve_forever()
