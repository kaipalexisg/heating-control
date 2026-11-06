# Heating Control V9

Mobile-first static frontend για κατανομή αγορών πετρελαίου μεταξύ δύο ορόφων.

## Άνοιγμα σε Cursor / Claude Code
1. Κατέβασε το ZIP από **Code → Download ZIP** στο GitHub.
2. Αποσυμπίεσε και άνοιξε τον φάκελο στο Cursor ή στο Claude Code.
3. Διάβασε πρώτα το `PROJECT_BRIEF_GR.md`.
4. Κύρια εφαρμογή: `index.html` (HTML/CSS/JS χωρίς build step).
5. Live: https://kaipalexisg.github.io/heating-control/

## Αρχιτεκτονική
- Frontend: GitHub Pages, `index.html`.
- Backend: Google Apps Script (endpoint δηλωμένο στο `API` του `index.html`).
- Data: Google Sheets, `Heating Control Data`.
- Read: JSONP snapshot. Write: hidden iframe form POST, με polling μετά την αποστολή.
- Το server-side `Code.gs` περιλαμβάνεται στο repository ως αντίγραφο πηγαίου κώδικα, χωρίς credentials. Οι αλλαγές σε αυτό δεν δημοσιεύονται αυτόματα στο Apps Script.

## Βασικοί κανόνες
- Ισόγειο: 128,27 τ.μ. · 1ος: 93,93 τ.μ.
- Προεπιλογή: ώρες λειτουργίας περιόδου × τ.μ.· επιλογή «μόνο ώρες» για σύγκριση.
- Εμφάνιση ενδεικτικού επιμερισμού κόστους αγορών, όχι πραγματικής κατανάλωσης.
- Κράτα το mobile-first UI, ελληνικά labels, και την υπάρχουσα σύνδεση.
- Μην προσθέτεις δοκιμαστικά δεδομένα στο παραγωγικό Google Sheet.

## Επόμενο task
Διόρθωσε τη V9 ώστε τα ποσά/ποσοστά σε ΟΛΕΣ τις κάρτες και στο summary να συμφωνούν με τον επιλογέα μεθόδου. Έλεγξε το άδειο Sheet. Κάνε αλλαγές με μικρά βήματα και έλεγχο πριν το deploy.

Δες `PROJECT_BRIEF_GR.md` για πλήρες context και εκκρεμότητες.
