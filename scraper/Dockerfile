FROM python:3.11-slim

# playwright --with-deps installs chromium + all system libs it needs
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch \
    && pip install --no-cache-dir -r requirements.txt

# Install chromium and its OS dependencies in one step
RUN playwright install --with-deps chromium

# Readability must work offline from a fresh container, not download a corpus
# during the first article. Fail the build if this required data is absent.
RUN python -c "import nltk; nltk.download('cmudict', download_dir='/usr/local/share/nltk_data', raise_on_error=True); from nltk.corpus import cmudict; assert cmudict.words()"

COPY . .

CMD ["python", "run_all.py"]
