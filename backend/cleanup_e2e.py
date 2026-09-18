import sqlite3

conn = sqlite3.connect('forensic.db')
c = conn.cursor()
c.execute("SELECT id FROM cases WHERE case_number='CASE-E2E-999'")
rows = c.fetchall()
for r in rows:
    print('Deleting old E2E test case:', r[0])
    c.execute('DELETE FROM chain_of_custody WHERE case_id=?', (r[0],))
    c.execute('DELETE FROM evidence WHERE case_id=?', (r[0],))
    c.execute('DELETE FROM cases WHERE id=?', (r[0],))
conn.commit()
conn.close()
print('Done.')
