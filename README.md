# Allure Results Viewer

Open `index.html` in Chrome or Edge.

- **Open JSON files**: select one or more `*-result.json` files. The file picker shows JSON files. This displays test results and steps, but attachments will be unavailable unless their files were also provided.
- **Open results folder**: select the whole `allure-results` directory to include screenshots and other attachments. You can also select a parent directory containing several result folders and switch between them. This picker displays folders rather than JSON files. Chrome or Edge may label its confirmation button **Upload**, but the viewer only reads the files locally; it does not send them to a server.

After opening results, select a suite and test on the summary screen. Filter by status, device, or platform. The test opens in a full-width execution view with a clickable step timeline and screenshot panel. Use **Play steps** to advance automatically and choose a playback speed; the timeline follows the active step. The thumbnail strip lets you jump directly to any screenshot step. Inline screenshots stay contained in the panel, and clicking one opens the larger view. The viewer also shows status counts, errors, parameters, and attachments. Selecting a step shows its screenshot beside the timeline; when that step has none, it shows the latest screenshot from an earlier step. It requires no installation, server, internet connection, or Allure CLI on the viewing machine.

This is a lightweight viewer for raw execution results. It does not reproduce Allure's history, retry aggregation, categories, or fixture views. A report can contain sensitive test data and screenshots, so share its result folder accordingly.

To run its dependency-free check, use `node viewer.test.cjs`. Node.js is only needed for that check, not to view results.
