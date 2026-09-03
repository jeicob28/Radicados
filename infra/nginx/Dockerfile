FROM nginx:1.27-alpine

# La imagen oficial procesa /etc/nginx/templates/*.template con envsubst
# al arrancar, sustituyendo ${API_UPSTREAM} y ${WEB_UPSTREAM}.
COPY default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
