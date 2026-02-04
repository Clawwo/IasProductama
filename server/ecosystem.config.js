module.exports = {
  apps: [
    {
      name: 'nest-api',
      script: 'dist/main.js',
      env: {
        PGSSLROOTCERT: '/home/iasproductama/supabase-ca-bundle.pem',
        NODE_EXTRA_CA_CERTS: '/home/iasproductama/supabase-ca-bundle.pem',
        SSL_CERT_FILE: '/home/iasproductama/supabase-ca-bundle.pem',
        DATABASE_URL:
          'postgresql://postgres.fysjbxgdbjqhalesmlri:DKIkFRZIKBuZbtPU@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require&sslrootcert=/home/iasproductama/supabase-ca-bundle.pem',
        DIRECT_URL:
          'postgresql://postgres.fysjbxgdbjqhalesmlri:DKIkFRZIKBuZbtPU@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require&sslrootcert=/home/iasproductama/supabase-ca-bundle.pem',
        CORS_ORIGINS:
          'http://localhost:5173,http://127.0.0.1:5173,https://iasproductama.site,https://www.iasproductama.site,https://api.iasproductama.site',
      },
    },
  ],
};
