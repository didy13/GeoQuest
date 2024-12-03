let connection;
class User {
    constructor(firstname, lastname, email, title, message) {
      this.firstname = firstname;
      this.lastname = lastname;
      this.email = email;
      this.title = title;
      this.message = message;
    }
    static setConnection(conn)
    {
        connection = conn;
    }
    save() {
        const query = 'INSERT INTO users (first_name, last_name, email, title, message) VALUES (?, ?, ?, ?, ?)';
        const values = [this.firstname, this.lastname, this.email, this.title, this.message];
    
        return new Promise((resolve, reject) => {
          connection.query(query, values, (error, results) => {
            if (error) {
              return reject(error);
            }
            resolve(results);
          });
        });
      }
    
}
module.exports = User;