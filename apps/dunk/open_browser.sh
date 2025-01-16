#!/bin/bash
HASH=`openssl x509 -pubkey -noout -in cert.pem |
    openssl pkey -pubin -outform der |
    openssl dgst -sha256 -binary |
    base64`

chromium \
    --ignore-certificate-errors-spki-list=$HASH \
    --origin-to-force-quic-on=127.0.0.1:3000 \
    https://localhost:3000
