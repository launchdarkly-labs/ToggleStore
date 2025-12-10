import os

def main():
    update_deploy_files()

def update_deploy_files():
    namespace = os.getenv('NAMESPACE')
    url = "{0}.launchdarklydemos.com".format(namespace)
    image_url = os.getenv('IMAGE')
    tls_secret_name = "{0}-tls-secret".format(namespace)
    
    # Use DEPLOY_FILE if provided (for temporary files), otherwise use default
    deploy_file_path = os.getenv('DEPLOY_FILE')
    if not deploy_file_path:
        # Get the script's directory and construct the deploy file path
        script_dir = os.path.dirname(os.path.abspath(__file__))
        deploy_file_path = os.path.join(script_dir, "deploy_files", "deploy.yaml")
    
    if not os.path.exists(deploy_file_path):
        print(f"Error: Deploy file not found at {deploy_file_path}")
        return
    
    # Read the file
    with open(deploy_file_path, 'r') as f:
        content = f.read()
    
    # Replace placeholders
    content = content.replace('placeholder1', namespace)
    content = content.replace('placeholder2', url)
    content = content.replace('placeholder3', namespace)
    content = content.replace('placeholder4', image_url)
    content = content.replace('placeholder-tls-secret', tls_secret_name)
    
    # Write back to file
    with open(deploy_file_path, 'w') as f:
        f.write(content)
    
    print(f"Updated deployment file: {deploy_file_path}")
    print(f"  Namespace: {namespace}")
    print(f"  URL: {url}")
    print(f"  Image: {image_url}")

if __name__ == "__main__":
	main()