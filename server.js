const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let transcripts = [];

app.post('/upload', upload.array('transcripts'), async (req, res) => {
  const files = req.files;
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  for (const file of files) {
    const content = fs.readFileSync(file.path, 'utf8');
    const summary = await getSummary(model, content);
    const findings = await getFindings(model, content);
    transcripts.push({
      name: file.originalname,
      content,
      summary,
      findings
    });
  }

  res.json({ message: 'Transcripts processed successfully', transcripts });
});

app.post('/ask', async (req, res) => {
  const { question } = req.body;
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  try {
    const result = await model.generateContent([
      ...transcripts.map(transcript => ({ text: transcript.content })),
      { text: `Question: ${question}` }
    ]);
    const response = await result.response;
    res.json({ answer: response.text() });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

async function getSummary(model, content) {
  const result = await model.generateContent([
    { text: content },
    { text: "Please provide a concise summary of the above transcript in about 3-4 sentences." }
  ]);
  const response = await result.response;
  return response.text();
}

async function getFindings(model, content) {
  const result = await model.generateContent([
    { text: content },
    { text: "Please list the top 3-5 key findings or important points from the above transcript." }
  ]);
  const response = await result.response;
  return response.text();
}

app.get('/transcripts', (req, res) => {
  res.json(transcripts);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));