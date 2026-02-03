module.exports = {
  apps: [
    {
      name: "nest-api",
      script: "dist/main.js",
      env: {
        PGSSLROOTCERT: "/home/iasproductama/supabase-root-2021.pem",
        DATABASE_URL:
          "postgresql://postgres.fysjbxgdbjqhalesmlri:DKIkFRZIKBuZbtPU@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require&sslrootcert=/home/iasproductama/supabase-root-2021.pem",
        DIRECT_URL:
          "postgresql://postgres.fysjbxgdbjqhalesmlri:DKIkFRZIKBuZbtPU@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require&sslrootcert=/home/iasproductama/supabase-root-2021.pem",
        CORS_ORIGINS:
          "http://localhost:5173,http://127.0.0.1:5173,https://iasproductama.site,https://www.iasproductama.site,https://api.iasproductama.site",
      },
    },
  ],
};
