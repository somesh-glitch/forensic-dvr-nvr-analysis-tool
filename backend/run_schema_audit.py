import os
import sqlite3

def run_db_audit():
    db_path = "forensic.db"
    
    if not os.path.exists(db_path):
        print(f"Error: Database file not found at {db_path}")
        return

    print("====================================================")
    print("STARTING SQLITE DATABASE INTEGRITY AUDIT")
    print("====================================================")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get list of tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall() if not row[0].startswith("sqlite_")]
    print(f"Database Tables Found: {tables}\n")

    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"  Table: {table:<20} | Row Count: {count}")

    print("\n----------------------------------------------------")
    print("RELATIONAL INTEGRITY & ORPHANS AUDIT")
    print("----------------------------------------------------")

    # 1. Check for Evidence orphans
    cursor.execute("SELECT COUNT(*) FROM evidence WHERE case_id NOT IN (SELECT id FROM cases)")
    ev_orphans = cursor.fetchone()[0]
    print(f"  Orphaned Evidence rows (invalid case_id): {ev_orphans}")

    # 2. Check for Camera orphans
    cursor.execute("SELECT COUNT(*) FROM cameras WHERE evidence_id NOT IN (SELECT id FROM evidence)")
    cam_orphans = cursor.fetchone()[0]
    print(f"  Orphaned Camera rows (invalid evidence_id): {cam_orphans}")

    # 3. Check for Video orphans
    cursor.execute("SELECT COUNT(*) FROM videos WHERE camera_id NOT IN (SELECT id FROM cameras)")
    vid_orphans = cursor.fetchone()[0]
    print(f"  Orphaned Video rows (invalid camera_id): {vid_orphans}")

    # 4. Check for AIDetection orphans
    cursor.execute("SELECT COUNT(*) FROM ai_detections WHERE video_id NOT IN (SELECT id FROM videos)")
    ai_orphans = cursor.fetchone()[0]
    print(f"  Orphaned AIDetection rows (invalid video_id): {ai_orphans}")

    # 5. Check for ChainOfCustody orphans
    cursor.execute("SELECT COUNT(*) FROM chain_of_custody WHERE case_id NOT IN (SELECT id FROM cases)")
    coc_orphans = cursor.fetchone()[0]
    print(f"  Orphaned ChainOfCustody rows (invalid case_id): {coc_orphans}")

    # 6. Check for Report orphans
    cursor.execute("SELECT COUNT(*) FROM reports WHERE case_id NOT IN (SELECT id FROM cases)")
    rep_orphans = cursor.fetchone()[0]
    print(f"  Orphaned Report rows (invalid case_id): {rep_orphans}")

    print("\n----------------------------------------------------")
    print("DUPLICATE INSPECTION")
    print("----------------------------------------------------")

    # Check for duplicate cameras per evidence file
    cursor.execute("SELECT evidence_id, channel_number, COUNT(*) FROM cameras GROUP BY evidence_id, channel_number HAVING COUNT(*) > 1")
    dup_cams = cursor.fetchall()
    print(f"  Duplicate camera channels registered per evidence file: {len(dup_cams)}")

    # Check for duplicate detections
    cursor.execute("SELECT video_id, frame_number, label, COUNT(*) FROM ai_detections GROUP BY video_id, frame_number, label HAVING COUNT(*) > 1")
    dup_dets = cursor.fetchall()
    print(f"  Duplicate AI detections registered: {len(dup_dets)}")

    print("\n====================================================")
    print("STORAGE AND DIRECTORY FOLDER AUDIT")
    print("====================================================")
    storage_dir = "../storage"
    
    subdirs = ["extracted", "recovered", "reports", "uploads"]
    for sub in subdirs:
        path = os.path.join(storage_dir, sub)
        if os.path.exists(path):
            files = os.listdir(path)
            print(f"  Storage/{sub:<12} | Files: {len(files)} items")
            for f in files[:5]: # print first 5 files
                print(f"    - {f}")
            if len(files) > 5:
                print(f"    - ... and {len(files)-5} more")
        else:
            print(f"  Storage/{sub:<12} | Directory does not exist!")

    conn.close()

if __name__ == "__main__":
    run_db_audit()
