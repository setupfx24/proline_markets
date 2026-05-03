-- Grants admins the ability to extend an employee's permissions beyond their role default.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS extra_permissions JSONB DEFAULT '[]'::jsonb;
