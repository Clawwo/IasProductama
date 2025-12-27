-- Seed database with sample users
INSERT INTO "User" (id, email, password, name, role, "isActive", "createdAt", "updatedAt") VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'superadmin@jogjadrumband.com', '$2a$04$8T3C2/piLmRYPPwI9FOVHuLlwwz8wE9O65/87n/ML0I2ahh.TUWUq', 'Super Admin', 'SUPERADMIN', true, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440001', 'admin@jogjadrumband.com', '$2a$04$8T3C2/piLmRYPPwI9FOVHuLlwwz8wE9O65/87n/ML0I2ahh.TUWUq', 'Admin User', 'ADMIN', true, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'petugas@jogjadrumband.com', '$2a$04$8T3C2/piLmRYPPwI9FOVHuLlwwz8wE9O65/87n/ML0I2ahh.TUWUq', 'Petugas User', 'PETUGAS', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;
