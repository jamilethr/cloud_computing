FROM nginx:1.27-alpine

# Cloud Run sets PORT at runtime; 8080 is the local default.
ENV PORT=8080

# The official nginx image fills ${PORT} in this template when the container starts.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY web/ /usr/share/nginx/html/
