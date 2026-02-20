-- =========================================
-- Migration: Add 'cancellation' to stock_reason_check
-- Run this on existing databases
-- =========================================

-- First, drop the existing constraint
ALTER TABLE stock_transactions DROP CONSTRAINT IF EXISTS stock_reason_check;

-- Add the new constraint with 'cancellation' included
ALTER TABLE stock_transactions 
ADD CONSTRAINT stock_reason_check 
CHECK (reason IN ('purchase', 'admin_add', 'admin_remove', 'cancellation'));
