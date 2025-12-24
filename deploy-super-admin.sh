#!/bin/bash
curl -X POST "https://elmkttswkwwjfhnwnama.supabase.co/functions/v1/create-super-admin" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsbWt0dHN3a3d3amZobnduYW1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMjQ3NTgsImV4cCI6MjA3NTkwMDc1OH0.4mPwhoztAU-c7ipp-UGazyoqOjg107kLt-l6btqVUao" \
  -d '{"email":"superadmin@kys.com","password":"SuperAdmin123!","fullName":"Super Admin"}'
