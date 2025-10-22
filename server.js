import express from "express";
import fetch from "node-fetch";
import multer from "multer";
import fs from "fs";
import FormData from "form-data";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.static("public"));

app.post("/enhance", upload.single("image"), async (req, res) => {
  const imagePath = req.file.path;

  // Upload image to Replicate API
  const form = new FormData();
  form.append("version", "92834d6d4353c903b60f7f8abf2a62a6ff3cc08a5d216ef7c6108c8d2f6b56d3"); // Real-ESRGAN model
  form.append("input", JSON.stringify({ image: fs.createReadStream(imagePath) }));

  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
    },
    body: form,
  });

  const data = await response.json();

  if (!data.urls) {
    return res.status(500).json({ error: "Failed to start prediction" });
  }

  // Poll until processing is complete
  let output;
  while (!output) {
    const status = await fetch(data.urls.get, {
      headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` },
    });
    const result = await status.json();
    if (result.status === "succeeded") {
      output = result.output[0];
    } else if (result.status === "failed") {
      return res.status(500).json({ error: "Enhancement failed" });
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  fs.unlinkSync(imagePath); // delete temp upload
  res.json({ enhancedUrl: output });
});

app.listen(3000, () => console.log("Server running at http://localhost:3000"));
