#!/bin/sh
# Genera un certificado TLS autofirmado la primera vez que arranca el proxy
# (uso intranet: sin dominio público, no aplica una CA como Let's Encrypt).
# El certificado se guarda en un volumen y se reutiliza en los siguientes
# arranques, para no forzar a los usuarios a volver a confiar en él cada vez.
#
# TLS_HOST: IP o nombre por el que el personal accede a la app (obligatorio
# para que el navegador acepte el certificado sin error de nombre).
set -e

CERT_DIR=/etc/nginx/certs
CRT="$CERT_DIR/server.crt"
KEY="$CERT_DIR/server.key"
mkdir -p "$CERT_DIR"

if [ ! -f "$CRT" ] || [ ! -f "$KEY" ]; then
  HOST="${TLS_HOST:-localhost}"
  case "$HOST" in
    ''|*[!0-9.]*) EXTRA_SAN="DNS:$HOST" ;;
    *)            EXTRA_SAN="IP:$HOST"  ;;
  esac
  SAN="$EXTRA_SAN,DNS:localhost,IP:127.0.0.1"

  echo "[gen-cert] generando certificado TLS autofirmado para '$HOST' (SAN: $SAN)"
  openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 3650 \
    -keyout "$KEY" -out "$CRT" \
    -subj "/CN=$HOST/O=SGDEA Radicacion/C=CO" \
    -addext "subjectAltName=$SAN"
  chmod 644 "$CRT"
  chmod 600 "$KEY"
  echo "[gen-cert] listo (válido 10 años). El navegador mostrará una advertencia la"
  echo "[gen-cert] primera vez por ser autofirmado; es normal en un sitio de intranet."
else
  echo "[gen-cert] certificado TLS existente, se reutiliza ($CRT)"
fi
