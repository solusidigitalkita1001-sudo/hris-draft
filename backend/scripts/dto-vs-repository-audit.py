#!/usr/bin/env python3
"""Cari field yang diterima zod schema tapi tidak pernah ditulis repository.

Lahir dari satu bug: `isFixedAllowance` diterima `createSalaryComponentSchema`
tapi tidak dipetakan di `createSalaryComponent`, sehingga basis THR mengecil
tanpa error (lihat docs/PROGRESS.md). Pertanyaan sesudahnya — di mana lagi? —
dijawab oleh skrip ini.

Jalankan dari direktori `backend/`:

    python3 scripts/dto-vs-repository-audit.py

Heuristiknya sengaja kasar dan **meleset ke arah lapor-lebih**: sebuah field
disebut hilang kalau namanya tidak muncul sama sekali di body method yang
menerima DTO-nya. Method yang meneruskan `data`/`dto` utuh (spread, atau sebagai
argumen) dilewati, karena di sana tidak ada field yang bisa hilang.

Hasil jalan pertama (Oktober 2026): 7 kandidat, 6 di antaranya pass-through yang
lolos saringan, 1 nyata (`PayrollRun.notes`). Jadi perlakukan keluarannya sebagai
daftar untuk ditriase tangan, bukan daftar bug.
"""
import re
import glob

DTO_FIELD = re.compile(r"^\s{2}(\w+):\s*z\.", re.M)
SCHEMA = re.compile(r"export const (\w+Schema)\s*=\s*z\.object\(\{(.*?)^\}\)", re.S | re.M)
METHOD = re.compile(r"async\s+(\w+)\s*\(([^)]*)\)\s*\{")
# data/dto diteruskan utuh ke pemanggil lain -> tidak ada field yang bisa hilang
PASS_THROUGH = re.compile(r"\.\.\.\s*(data|dto)\b|\{\s*data\s*\}|data:\s*(data|dto)\b|[(,]\s*(data|dto)\s*[,)]")


def schema_fields():
    found = {}
    for path in glob.glob('src/modules/**/*.dto.ts', recursive=True):
        for name, body in SCHEMA.findall(open(path).read()):
            found[name] = set(DTO_FIELD.findall(body))
    return found


def schema_name_for(dto_type):
    base = dto_type[:-3]                      # CreateAssetDTO -> CreateAsset
    return base[0].lower() + base[1:] + 'Schema'


def body_after(src, brace_index):
    depth = 0
    for i in range(brace_index, len(src)):
        if src[i] == '{':
            depth += 1
        elif src[i] == '}':
            depth -= 1
            if depth == 0:
                return src[brace_index:i + 1]
    return src[brace_index:]


def main():
    schemas = schema_fields()
    findings = []
    for path in sorted(glob.glob('src/modules/**/*.ts', recursive=True)):
        if path.endswith('.test.ts') or path.endswith('.dto.ts'):
            continue
        src = open(path).read()
        for match in METHOD.finditer(src):
            method, params = match.group(1), match.group(2)
            dtos = re.findall(r"\b((?:Create|Update)\w*DTO)\b", params)
            if not dtos:
                continue
            body = body_after(src, src.index('{', match.end() - 1))
            if PASS_THROUGH.search(body):
                continue
            for dto in dtos:
                key = schema_name_for(dto)
                if key not in schemas:
                    continue
                missing = [
                    field for field in sorted(schemas[key])
                    # companyId sering datang dari konteks permintaan, bukan dari body
                    if field != 'companyId' and not re.search(r"\b" + re.escape(field) + r"\b", body)
                ]
                if missing:
                    findings.append((path, method, key, missing))

    for path, method, key, missing in findings:
        print(f"{path}:{method}  <- {key}  TIDAK DISEBUT: {', '.join(missing)}")
    print(f"\ntotal kandidat: {len(findings)} (triase tangan, lihat docstring)")


if __name__ == '__main__':
    main()
