import "dotenv/config";
import { createApp } from "./app.js";

const port = process.env.PORT || 8000;
createApp().listen(port, () => {
  console.log(`SaveX API is running on port ${port}`);
});
