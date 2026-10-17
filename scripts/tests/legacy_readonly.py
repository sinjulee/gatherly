"""Local baseline regression. SELECT/PRAGMA only; no Prisma imports, fixtures or migration."""
from pathlib import Path
import hashlib
import sqlite3

root = Path(__file__).resolve().parents[2]
db = root / 'prisma/dev.db'
assert db.is_file(), 'Legacy DB missing; this test never creates a database'
before = hashlib.sha256(db.read_bytes()).hexdigest()
connection = sqlite3.connect(db.as_uri() + '?mode=ro', uri=True)
connection.execute('PRAGMA query_only=ON')
assert connection.execute('PRAGMA query_only').fetchone()[0] == 1
assert connection.execute('PRAGMA integrity_check').fetchall() == [('ok',)]
assert connection.execute('PRAGMA foreign_key_check').fetchall() == []
counts = {name: connection.execute('SELECT COUNT(*) FROM "' + name + '"').fetchone()[0] for name in ['FieldDay', 'Company', 'Material', 'ExhibitionCompany']}
assert counts == {'FieldDay': 3, 'Company': 180, 'Material': 16, 'ExhibitionCompany': 180}, '2026-10-16 baseline changed; review deliberately, never repair data in this test'
rows = connection.execute('''SELECT f.title, COUNT(m.id), SUM(CASE WHEN m.id IS NOT NULL AND m.deletedAt IS NULL THEN 1 ELSE 0 END), f.exhibitionId IS NOT NULL
FROM FieldDay f LEFT JOIN Material m ON m.fieldDayId=f.id WHERE f.deletedAt IS NULL GROUP BY f.id''').fetchall()
assert set(rows) == {('2006 푸드위크', 0, 0, 0), ('기후산업국제박람회', 12, 7, 0), ('ENTECH 2026 현장조사', 4, 3, 1)}
assert connection.execute('SELECT COUNT(*) FROM Material WHERE fieldDayId IS NULL').fetchone()[0] == 0
assert connection.execute('SELECT COUNT(*) FROM Material WHERE companyId IS NOT NULL AND sourceIndexId IS NOT NULL').fetchone()[0] == 4
assert connection.execute('''SELECT COUNT(*) FROM Material m JOIN FieldDay f ON f.id=m.fieldDayId
LEFT JOIN CurationIndex i ON i.id=m.sourceIndexId
LEFT JOIN ExhibitionCompany e ON e.companyId=m.companyId AND e.exhibitionId=i.exhibitionId
WHERE m.companyId IS NOT NULL AND (e.id IS NULL OR (f.exhibitionId IS NOT NULL AND f.exhibitionId != i.exhibitionId))''').fetchone()[0] == 0
for relative, size, digest in connection.execute('SELECT filePath,sizeBytes,sha256 FROM Material WHERE filePath IS NOT NULL'):
    file = (root / 'storage' / relative).resolve()
    assert file.is_relative_to((root / 'storage').resolve())
    assert file.is_file() and file.stat().st_size == size
    assert hashlib.sha256(file.read_bytes()).hexdigest() == digest
connection.close()
assert hashlib.sha256(db.read_bytes()).hexdigest() == before, 'DB changed during read-only regression'
print('PASS: read-only FieldDay/Company/Material relationships, integrity, media checksums; DB unchanged')
