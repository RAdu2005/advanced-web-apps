# Project Work 

## 1. Introduction
Your task is to implement a system that lets users register, login, and create text documents in a "cloud drive".

* **Concept:** Similar to Google Drive or OneDrive.
* **Core Functionality:** Users can have multiple documents, edit them, and remove them.
* **Access Control:** Non-authenticated users cannot see anything by default. However, links can be shared so a non-authenticated user can see the file (read-only), but not edit it.
* **Point system:**
    * **Max Points:** 50.
    * **Basic Features:** Worth 25 points (requires writing documentation).
    * **Goal:** Implement additional features to gather more points for higher grades.

## 2. Mandatory Requirements

### Technology Stack
* **Backend:** Must be implemented with **Node.js** with Typescript.
    * Allowed frameworks: Express, Meteor, or similar.
    * **Forbidden:** Java, PHP, Perl, Python, Ruby, etc.
* **Database:** All data must be saved to a MongoDB database. (Mongosh is installed and a server is running at the default address)
    * CMS usage (WordPress, Drupal) is **not allowed**.
* **Frontend:**
    * **Language:** UI must be in English. (Multiple languages allowed if implementing translation).
    * **Responsiveness:** Must be usable on mobile devices and desktop browsers.
    * **Recommended tools:** Use Tailwind for UI.

### Authentication
* Users must be able to register and login.
* Authorization methods: JWT or Session-based.
* Only authenticated users can see, add, or remove files.

## 3. Feature Specifications

### Authenticated Users
* **Document Management:** Add, remove, rename, and edit documents.
    * Only "text document" type is required.
    * No formatting tools required.
* **Permissions:**
    * Give editing permission to existing users.
    * Give view permission to any user via link.
* **Concurrency Handling:**
    * No simultaneous editing required.
    * **Restriction:** Two users cannot edit the same document at the same time. An informative message must be shown.
    * **Recovery:** If a tab is closed while editing, the user must have a way to return to editing.
* **Logout:** Users must be able to logout.

### Non-Authenticated Users
* Can register and login.
* Can view documents via shared links in read-only mode.

## 4. Documentation Requirements
Documentation is mandatory. Missing documentation results in **-100 points**.

 **Content:**
    * Technology choices, installation guidelines, and user manual.
    * List of implemented features and the points aimed for (use a table).

## 5. Features Table with Points

**Base:** Basic features + well-written documentation = **25 Points**.

### Optional Features (Points Added)
| Feature | Points |
| :--- | :--- |
| **Multiple Users (Real-time):** Work on same doc simultaneously without blocking/crashing | 8 |
| **Spreadsheets:** Simple implementation (Cell manipulation + SUM function) | 6 |
| **Comments:** Users can comment on parts of the document | 5 |
| **Folders:** Move files in folder hierarchy | 4 |
| **Testing:** Cypress (or similar) unit/automation tests (min. 10 cases) | 4 |
| **Slides:** Create presentation slides (headers + bullet points only) | 3 |
| **Frontend Framework:** React, Angular, Vue, etc. | 3 |
| **PDF Download:** Document can be downloaded as PDF | 3 |
| **WYSIWYG:** Editor integration (QuillJS, EditorJS, DraftJS, etc.) | 2 |
| **Profile Picture:** Select and store user profile image | 2 |
| **Recycle Bin:** Docs move to trash first; user empties when fit | 2 |
| **Uploads:** User can upload docs (images are sufficient) | 2 |
| **Translation:** UI available in 2+ languages | 2 |
| **Search:** Add search functionality | 2 |
| **Pagination:** Add pagination to document listing | 2 |
| **Metadata Display:** Show creation/update timestamps in drive | 1 |
| **Sorting:** Sort by name, creation, or last edit | 1 |
| **Dark Mode:** Application has dark and bright modes | 1 |
| **Cloning:** Option to clone existing document | 1 |
| **Custom Feature:** Relevant to theme (requires justification) | ? |

### Penalties (Points Deducted)
| Issue | Points |
| :--- | :--- |
| **Application does not work** | -100 |
| **No Documentation** | -100 |
| **Inappropriate Content** (Hate speech, memes, trash) | -100 |
| **Missing Basic Parts** (e.g., no DB, auth broken) | 0 to -25 |
| **Messy Project** (Code not divided into front/back folders, etc.) | 0 to -10 |
| **TypeScript Issues** (Not used or used badly/excessive "any") | 0 to -10 |
| **Language:** Code not written/commented in English | -10 |
| **No Comments:** Code is not commented at all | -10 |
| **Bad Comments:** Code is not commented properly | -5 |

## 6. Submission & Notes
* **Port Limit:** If more than 60k ports are used, the project will not be graded.