-- isFixedAllowance: deteksi dan backfill
--
-- Konteks: `salary_components.is_fixed_allowance` diterima DTO sejak kolomnya ada
-- tapi tidak pernah ditulis repository (diperbaiki di PR #98), jadi setiap baris
-- bernilai 0 apa pun yang diisi pengguna. Kolom itu menyusun "upah sebulan" —
-- basis THR (Permenaker 6/2016) dan tarif harian pencairan cuti — sehingga THR
-- yang sudah dibayar bisa lebih kecil dari seharusnya.
--
-- Berkas ini TIDAK untuk dijalankan utuh. Bagian 1 sampai 3 baca-saja; bagian 4
-- adalah UPDATE yang hanya boleh dijalankan atas id yang sudah disetujui HR.
-- Mana yang tunjangan tetap adalah keputusan HR, bukan heuristik SQL: yang bisa
-- dilakukan query ini hanya mempersempit kandidatnya.

-- ============================================================
-- 1. Apakah instalasi ini memang terkena?
-- ============================================================
-- Kalau hasilnya 0 baris, tidak ada yang perlu dikerjakan.
SELECT COUNT(*) AS komponen_tunjangan_yang_semuanya_false
  FROM salary_components
 WHERE deleted_at IS NULL
   AND type = 'ALLOWANCE'
   AND is_fixed_allowance = 0;

-- ============================================================
-- 2. Kandidat tunjangan tetap, per perusahaan
-- ============================================================
-- Disempitkan ke: tunjangan (bukan potongan), nominal tetap, bukan komponen
-- sistem (`*_AUTO`, `EWA-DEDUCT`). Kolom terakhir menunjukkan berapa karyawan
-- yang memegang komponen itu, supaya yang tidak dipakai siapa pun bisa diabaikan.
SELECT c.name                                  AS perusahaan,
       sc.id,
       sc.code,
       sc.name,
       sc.calculation_method,
       sc.amount,
       COUNT(DISTINCT esc.employee_salary_id)   AS dipakai_oleh
  FROM salary_components sc
  JOIN companies c ON c.id = sc.company_id
  LEFT JOIN employee_salary_components esc ON esc.salary_component_id = sc.id
 WHERE sc.deleted_at IS NULL
   AND sc.type = 'ALLOWANCE'
   AND sc.calculation_method = 'FIXED'
   AND sc.is_fixed_allowance = 0
   AND sc.code NOT LIKE '%\_AUTO' ESCAPE '\'
   AND sc.code <> 'EWA-DEDUCT'
 GROUP BY c.name, sc.id, sc.code, sc.name, sc.calculation_method, sc.amount
 ORDER BY c.name, sc.code;

-- ============================================================
-- 3. Apakah ada THR yang sudah dibayar dan menyentuh kandidat itu?
-- ============================================================
-- Ini yang menentukan apakah backfill saja cukup, atau ada pembayaran yang perlu
-- dikoreksi. Kalau ada baris di sini, THR tersebut dihitung dari basis yang
-- kemungkinan lebih kecil dari seharusnya.
SELECT c.name                AS perusahaan,
       pr.id                 AS payroll_run_id,
       pr.name               AS payroll_run,
       pr.run_type,
       pr.status,
       COUNT(DISTINCT p.id)  AS jumlah_payslip
  FROM payroll_runs pr
  JOIN companies c ON c.id = pr.company_id
  JOIN payslips p ON p.payroll_run_id = pr.id
  JOIN payslip_components pc ON pc.payslip_id = p.id
  JOIN salary_components sc ON sc.id = pc.salary_component_id
 WHERE pr.deleted_at IS NULL
   AND pr.run_type = 'THR'
   AND sc.type = 'ALLOWANCE'
   AND sc.calculation_method = 'FIXED'
   AND sc.is_fixed_allowance = 0
   AND sc.code NOT LIKE '%\_AUTO' ESCAPE '\'
 GROUP BY c.name, pr.id, pr.name, pr.run_type, pr.status
 ORDER BY c.name, pr.name;

-- ============================================================
-- 4. Backfill — hanya untuk id yang sudah disetujui HR
-- ============================================================
-- Ganti daftar id di bawah dengan hasil bagian 2 yang HR konfirmasi memang
-- tunjangan tetap. Jangan dijalankan tanpa daftar itu: tidak ada aturan otomatis
-- yang bisa membedakan tunjangan jabatan (tetap) dari tunjangan transport
-- harian (tidak tetap) hanya dari datanya.
--
-- START TRANSACTION;
-- UPDATE salary_components
--    SET is_fixed_allowance = 1
--  WHERE id IN ('isi-id-di-sini', 'dan-di-sini')
--    AND deleted_at IS NULL
--    AND type = 'ALLOWANCE';
-- -- periksa jumlah baris yang terpengaruh sebelum COMMIT
-- COMMIT;
