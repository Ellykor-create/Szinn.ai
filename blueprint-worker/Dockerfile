FROM python:3.12-slim
# Pango voor WeasyPrint; DejaVu Sans voor de planeetglyphs in de mandala (masterprompt 3.5)
RUN apt-get update && apt-get install -y --no-install-recommends libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV DATA_DIR=/data PYTHONUNBUFFERED=1
RUN python datalaag.py
CMD ["python", "worker.py"]
