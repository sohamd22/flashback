#!/usr/bin/env python3
"""
Simple deployment script for the Facial Recognition API
"""

import subprocess
import sys
import os


def run_command(cmd, description):
    """Run a command and handle errors"""
    print(f"\n🔄 {description}...")
    try:
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed:")
        print(f"Error: {e.stderr}")
        return False


def check_secrets():
    """Check if required Modal secrets exist"""
    print("\n🔍 Checking Modal secrets...")

    required_secrets = ["supabase-credentials"]

    for secret in required_secrets:
        if not run_command(f"modal secret list | grep {secret}", f"Checking {secret} secret"):
            print(f"\n❌ Missing secret: {secret}")
            print("Please create the required secrets:")
            print(f"  modal secret create {secret}")
            return False

    print("✅ All required secrets found")
    return True


def deploy():
    """Deploy the facial recognition API to Modal"""
    print("🚀 Starting Facial Recognition API deployment...")

    # Check if we're in the right directory
    if not os.path.exists("app.py"):
        print("❌ app.py not found. Please run this script from the facial-stuff directory.")
        return False

    # Check Modal installation
    if not run_command("modal --version", "Checking Modal installation"):
        print("Please install Modal: pip install modal")
        return False

    # Check secrets
    if not check_secrets():
        return False

    # Deploy to Modal
    if not run_command("modal deploy app.py", "Deploying to Modal"):
        return False

    print("\n🎉 Deployment completed successfully!")
    print("\nYour Facial Recognition API is now live!")
    print("Use 'modal app logs facial-recognition-api' to view logs")
    print("Use 'modal app stop facial-recognition-api' to stop the app")

    return True


def setup_secrets_guide():
    """Print guide for setting up secrets"""
    print("\n📋 Required Modal Secrets Setup Guide:")
    print("\n1. Supabase credentials:")
    print("   modal secret create supabase-credentials \\")
    print("     --from-dict SUPABASE_URL=https://jndwnqvfmyhdffwflfmt.supabase.co \\")
    print("     --from-dict SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuZHducXZmbXloZGZmd2ZsZm10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3ODg0OTMsImV4cCI6MjA3MzM2NDQ5M30.M4Cn2tV6uqBnPGSBqeKxsBhxCUr-QQvRrMCqsqCsqpk")

    print("\n2. After creating secrets, run this script again to deploy")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "secrets":
        setup_secrets_guide()
    else:
        if not deploy():
            print("\n💡 Run 'python deploy.py secrets' for setup instructions")
            sys.exit(1)