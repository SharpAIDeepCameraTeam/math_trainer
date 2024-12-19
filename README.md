# Math Competition Trainer

A web application to help students practice for math competitions like MATHCOUNTS, AMC 8, AMC 10, and AMC 12. Users can time their problem-solving speed and track their progress over time.

## Features

- Multiple competition types (MATHCOUNTS, AMC 8/10/12)
- Customizable number of questions and time limits
- Real-time progress tracking
- Detailed timing analysis for each question
- User accounts to save progress (optional)
- Visual speed analysis with trend lines

## Installation

1. Clone the repository:
```bash
git clone https://github.com/SharpAIDeepCameraTeam/math_trainer.git
cd math_trainer
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the application:
```bash
python app.py
```

The application will be available at `http://localhost:8000`.

## Usage

1. Open the application in your web browser
2. Choose your test type, number of questions, and time limit
3. Press the spacebar after completing each question
4. View your results and timing analysis
5. (Optional) Create an account to save your progress

## Deployment

### Docker

Build and run the Docker container locally:

```bash
docker build -t math-trainer .
docker run -p 8080:8080 math-trainer
```

### Koyeb

1. Install the Koyeb CLI:
```bash
curl -fsSL https://cli.koyeb.com/install.sh | bash
```

2. Login to Koyeb:
```bash
koyeb login
```

3. Deploy the application:
```bash
koyeb app init math-trainer
```

The application will be deployed and accessible through the Koyeb-provided URL.

## Health Check

The application includes a health check endpoint at `/health` that returns:
```json
{
    "status": "healthy",
    "timestamp": "2024-12-18T16:57:53-08:00"
}
```

This endpoint is used by Koyeb to monitor the application's health.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
