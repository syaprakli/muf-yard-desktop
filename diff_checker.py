
import difflib
import sys
import os

def diff_files(file1, file2):
    print(f"--- Diffing {os.path.basename(file1)} ---")
    try:
        with open(file1, 'r', encoding='utf-8') as f1, open(file2, 'r', encoding='utf-8') as f2:
            lines1 = f1.readlines()
            lines2 = f2.readlines()
            
            diff = difflib.unified_diff(lines1, lines2, fromfile='Main', tofile='Kopya', n=1)
            diff_output = ''.join(diff)
            if not diff_output:
                print("No differences found.")
            else:
                # Print only added lines in Kopya (lines starting with '+') to reduce noise
                # But context is important. So let's print the unified diff but limit length
                print(diff_output[:5000]) # Limit output
                if len(diff_output) > 5000:
                    print("... (truncated)")

    except Exception as e:
        print(f"Error: {e}")

main_dir = r"c:\Users\sefa\.gemini\antigravity\playground\TAMAMLANANLAR\MUF YARD\MufYard V-1.0"
kopya_dir = r"c:\Users\sefa\.gemini\antigravity\playground\TAMAMLANANLAR\MUF YARD\MufYard V-1.0 - Kopya"

diff_files(os.path.join(main_dir, "app.js"), os.path.join(kopya_dir, "app.js"))
diff_files(os.path.join(main_dir, "libs", "CoreManagers.js"), os.path.join(kopya_dir, "libs", "CoreManagers.js"))
diff_files(os.path.join(main_dir, "index.html"), os.path.join(kopya_dir, "index.html"))
