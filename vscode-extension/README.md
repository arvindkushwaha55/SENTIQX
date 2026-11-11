# SENTIQX for VS Code

Connects VS Code to the SENTIQX desktop app on this computer.

## Use it

1. Open the SENTIQX app.
2. Select some code.
3. Right-click and choose **SENTIQX: Analyse Selection**.

The result appears in the app's **Debug** tab.

## What it does with your code

- It reads code only when you run the command, after you allow it once.
- It sends code only to the SENTIQX app on this computer (`127.0.0.1`).
- The code leaves your computer only if you click **Review with Claude** in the app.
- A fix is applied only after a diff preview and your **Apply** in VS Code. Files are not saved, so you can undo.

## Automatic suggestions

Off by default. Turn them on with the command **SENTIQX: Turn Automatic Suggestions On or Off**. When on, saving a file with a new error sends the lines around that error to the app.
