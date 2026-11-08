# Redact

- Delete your own Discord and Instagram messages and reactions from a desktop app.
- Only works with these apps, others apps gives you a hard time and if you have something that needs bulk deletion change your usernames, transfer emails to a @onionmail and leave it to be deleted
- made using claud

## Features
- Delete your own messages or remove your own reactions
- Pick specific DMs, servers or conversations, or select everything
- Filter by keyword and by age (older than X days)
- Dry run mode that only counts what would be deleted
- Logs you out and clears all stored data when you quit
- Runs on macOS (Apple Silicon and Intel) and Windows

## Build it yourself

### 1. Requirements
Install [Node.js](https://nodejs.org) (LTS version) and [Git](https://git-scm.com).

### 2. Download and install
```
git clone https://github.com/SkypMine-max/-Redact
cd -Redact
npm install
```

### 3. Run it without building
```
npm start
```

### 4. Build it into an app
Run the command that matches your computer from the `Redact` folder:

| System | Command | Output folder |
| --- | --- | --- |
| Mac, Apple Silicon (M1/M2/M3/M4) | `npm run package:mac-arm` | `Redact-darwin-arm64/Redact.app` |
| Mac, Intel | `npm run package:mac-intel` | `Redact-darwin-x64/Redact.app` |
| Windows 64-bit | `npm run package:win` | `Redact-win32-x64/Redact.exe` |

If a script isn't found, run the packager directly:
```
npx electron-packager . Redact --overwrite --platform=darwin --arch=arm64 --icon=assets/Redact.icns
npx electron-packager . Redact --overwrite --platform=darwin --arch=x64 --icon=assets/Redact.icns
npx electron-packager . Redact --overwrite --platform=win32 --arch=x64 --icon=assets/Redact.ico
```

Notes:
- Build the Mac versions on a Mac. Build the Windows version on a Windows PC (building it on a Mac with the icon needs Wine: `brew install --cask wine-stable`, or leave out `--icon`).
- On Windows, keep the whole output folder together. `Redact.exe` does not run without the files next to it.
- Drag `Redact.app` into your Applications folder to keep it.

### 5. First launch warning
The app is not code signed, so your system may warn you.
- **Mac:** right-click `Redact.app`, choose **Open**, then click **Open** again.
- **Windows:** in the SmartScreen box click **More info**, then **Run anyway**.

## Project structure
```
assets/            Redact.png (logo), icon.png, Redact.icns (macOS), Redact.ico (Windows)
src/main.js        Electron main process
src/preload.js     Bridge between the UI and the main process
src/ui/            Interface (index.html)
src/platforms/     One module per platform (discord, instagram)
```

## Disclaimer
Redact automates actions on your own account. Automating user accounts may go against
the terms of service of Discord and Instagram, and accounts can be restricted or banned.
Use it at your own risk, start with a dry run, and only use it on your own account.
Deleted messages cannot be recovered.
