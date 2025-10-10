from flask import Flask, request, make_response, render_template_string

app = Flask(__name__)

# HTML form for both GET and POST
html_form = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
    /* CSS code for styling the form */
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            padding: 20px;
            align-items: center;
            justify-content: center;
            
        }
        form {
            display: flex;
            flex-direction: column;
            max-width: 300px;
            justify-content: center;
            margin: auto;
            
        }
    </style>
</head>


# HTML body with a form
<body>
   <form action="/submit" method="post">
       <label>Email:</label>
       <input type="text" name="email"><br>
       <label>Password:</label>
       <input type="password" name="password"><br>
       <input type="submit" value="Submit">
   </form>
</body>
</html>

'''

# Route for GET - Display form
@app.route('/', methods=['GET'])
def index():
    return render_template_string(html_form)

# Route for POST - Handle form submission
@app.route('/submit', methods=['POST'])
def submit():
    email = request.form.get('email')
    password = request.form.get('password')
    
    # Creating a response object
    response = make_response(f"Received POST request.<br>Email: {email}<br>Password: {password}")
    response.headers['Custom-Header'] = 'Success'
    return response

if __name__ == '__main__':
    app.run(debug=True)
