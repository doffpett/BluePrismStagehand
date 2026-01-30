# Blue Prism + Stagehand Integration

Demo-prosjekt som viser hvordan Blue Prism kan bruke Stagehand for AI-drevet nettleserautomatisering.

## Arkitektur

```
Blue Prism VBO → HTTP REST API → Node.js Server → Stagehand → Chrome
```

## Oppsett

### 1. Installer avhengigheter

```bash
cd BluePrismStagehand
npm install
npx playwright install chromium
```

### 2. Sett API-nøkkel

```bash
# Windows (PowerShell)
$env:ANTHROPIC_API_KEY="din-api-nøkkel"

# Eller lag .env fil
echo ANTHROPIC_API_KEY=din-api-nøkkel > .env
```

### 3. Start server

```bash
npm start
```

Server kjører på `http://localhost:3000`

---

## Blue Prism VBO - Code Stages

### Hjelpefunksjon: HttpPost

Lag et Code Stage med denne C#-koden som kan gjenbrukes:

```csharp
// Inputs: url (Text), jsonBody (Text)
// Outputs: response (Text), success (Flag)

using System.Net;
using System.IO;
using System.Text;

try
{
    var request = (HttpWebRequest)WebRequest.Create(url);
    request.Method = "POST";
    request.ContentType = "application/json";

    byte[] data = Encoding.UTF8.GetBytes(jsonBody);
    request.ContentLength = data.Length;

    using (var stream = request.GetRequestStream())
    {
        stream.Write(data, 0, data.Length);
    }

    using (var httpResponse = (HttpWebResponse)request.GetResponse())
    using (var reader = new StreamReader(httpResponse.GetResponseStream()))
    {
        response = reader.ReadToEnd();
        success = true;
    }
}
catch (Exception ex)
{
    response = ex.Message;
    success = false;
}
```

---

### Action: Initialize Browser

```csharp
// Inputs: (ingen)
// Outputs: success (Flag), message (Text)

string url = "http://localhost:3000/init";
string jsonBody = "{}";

// Kall HttpPost helper
// Parse JSON response for success/message
```

---

### Action: Navigate To URL

```csharp
// Inputs: targetUrl (Text)
// Outputs: success (Flag), message (Text)

string url = "http://localhost:3000/goto";
string jsonBody = "{\"url\": \"" + targetUrl.Replace("\"", "\\\"") + "\"}";

// Kall HttpPost helper
```

---

### Action: Act (AI Action)

```csharp
// Inputs: actionDescription (Text)
// Outputs: success (Flag), result (Text)

string url = "http://localhost:3000/act";
string jsonBody = "{\"action\": \"" + actionDescription.Replace("\"", "\\\"") + "\"}";

// Kall HttpPost helper
// Eksempel: actionDescription = "Click the login button"
```

---

### Action: Extract (AI Data Extraction)

```csharp
// Inputs: instruction (Text)
// Outputs: success (Flag), extractedData (Text)

string url = "http://localhost:3000/extract";
string jsonBody = "{\"instruction\": \"" + instruction.Replace("\"", "\\\"") + "\"}";

// Kall HttpPost helper
// Eksempel: instruction = "Get all product names and prices from the table"
```

---

### Action: Observe (AI Page Analysis)

```csharp
// Inputs: instruction (Text)
// Outputs: success (Flag), observations (Text)

string url = "http://localhost:3000/observe";
string jsonBody = "{\"instruction\": \"" + instruction.Replace("\"", "\\\"") + "\"}";

// Kall HttpPost helper
// Eksempel: instruction = "What actions can I take on this page?"
```

---

### Action: Close Browser

```csharp
// Inputs: (ingen)
// Outputs: success (Flag)

string url = "http://localhost:3000/close";
string jsonBody = "{}";

// Kall HttpPost helper
```

---

## Eksempel: Demo Workflow

1. **Initialize Browser** - Starter Chrome
2. **Navigate To URL** - `https://www.google.com`
3. **Act** - `"Type 'Blue Prism RPA' in the search box"`
4. **Act** - `"Click the search button"`
5. **Extract** - `"Get the titles of the first 5 search results"`
6. **Close Browser**

---

## API Endpoints

| Endpoint | Method | Body | Beskrivelse |
|----------|--------|------|-------------|
| `/init` | POST | `{}` | Start browser |
| `/goto` | POST | `{"url": "..."}` | Naviger til URL |
| `/act` | POST | `{"action": "..."}` | Utfør handling |
| `/extract` | POST | `{"instruction": "..."}` | Ekstraher data |
| `/observe` | POST | `{"instruction": "..."}` | Analyser side |
| `/close` | POST | `{}` | Lukk browser |
| `/health` | GET | - | Helsesjekk |

---

## Test med curl

```bash
# Initialize
curl -X POST http://localhost:3000/init

# Navigate
curl -X POST http://localhost:3000/goto -H "Content-Type: application/json" -d '{"url":"https://google.com"}'

# Act
curl -X POST http://localhost:3000/act -H "Content-Type: application/json" -d '{"action":"Click the search box"}'

# Extract
curl -X POST http://localhost:3000/extract -H "Content-Type: application/json" -d '{"instruction":"What is the page title?"}'

# Close
curl -X POST http://localhost:3000/close
```
