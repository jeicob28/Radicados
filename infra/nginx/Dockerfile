FROM nginx:1.27-alpine

RUN apk add --no-cache openssl

# La imagen oficial procesa /etc/nginx/templates/*.template con envsubst
# al arrancar, sustituyendo ${API_UPSTREAM} y ${WEB_UPSTREAM}.
COPY default.conf.template /etc/nginx/templates/default.conf.template

# Genera (o reutiliza) el certificado TLS autofirmado antes de arrancar nginx.
# La imagen oficial ejecuta todo /docker-entrypoint.d/*.sh, en orden, antes de exec nginx.
COPY docker-entrypoint.d/10-gen-cert.sh /docker-entrypoint.d/10-gen-cert.sh
RUN chmod +x /docker-entrypoint.d/10-gen-cert.sh

EXPOSE 80 443
