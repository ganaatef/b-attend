-- Preserve an explicit source-of-truth for native employee app punches.
ALTER TYPE "PunchSource" ADD VALUE IF NOT EXISTS 'MOBILE_APP';

