const sqlite3 = require('sqlite3');
// @ts-ignore
const crypto = require('crypto');

/**
 * password hashing function
 *
 * @param password
 * @returns {Promise<string>}
 */
async function hash(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hash));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkCredentials(username, password) {
    console.log(`checking credentials for user ${username}`);
    // Open the database
    const db = await new sqlite3.Database('server/users.db', (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Connected to the database.');
    });

    // check if the username and password are correct
    let result = await new Promise((resolve) => {
        db.get('SELECT * FROM users WHERE username = ?', username, async function (err, row) {
            if (err) throw err;
            // @ts-ignore
            if (row && row.password === await hash(password)) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });

    // Close the database
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Closed the database connection.');
    });

    return result;
}

/**
 * function to add a new user to the database
 *
 * @param username
 * @param password
 * @param role
 * @returns {Promise<void>}
 */
async function addUser(username, password = 'password', role = 'user') {
    console.log(`creating user ${username}`)
    // Open the database
    const db = await new sqlite3.Database('server/users.db', (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Connected to the database.');
    });

    // create the users table if it doesn't exist
    await db.run(`
 CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT NOT NULL UNIQUE,
 password TEXT NOT NULL,
 role TEXT
 );
 `);

    // insert the new user into the database
    await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', username, await hash(password), role, function (err) {
        if (err) throw err;
        console.log(`User '${username}' added to database.`);
    });

    // Close the database
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Closed the database connection.');
    });
}

/**
 * login function, authenticates user given credentials
 *
 * @param ws websocket (user sending request)
 * @param username
 * @param password
 * @returns {Promise<void>}
 */
async function login(ws, username, password) {
    // Open the database
    const db = new sqlite3.Database('server/users.db', (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Connected to the database.');
    });

    if (username && password) {
        // Query the database for the user
        await db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, await hash(password)], (err, row) => {
            if (err) {
                console.error(err.message);
            } else if (!row) {
                ws.send(JSON.stringify({type: 'login', success: false, error: 'Incorrect username or password'}));
            } else {
                // User exists and password is correct
                // @ts-ignore
                ws.send(JSON.stringify({
                    type: 'login',
                    success: true,
                    id: row.id,
                    username: row.username,
                    role: row.role
                }));
            }
        });
    } else {
        // Invalid input
        ws.send(JSON.stringify({type: 'login', success: false, error: 'Incorrect username or password'}));
    }

    // Close the database
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Closed the database connection.');
    });
}

async function changeUsername(username, newUsername, password) {
    if (!await checkCredentials(username, password)) {
        return false;
    }
    let result = false;
    console.log(`changing username from ${username} to ${newUsername}`);
    // Open the database
    const db = await new sqlite3.Database('server/users.db', (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Connected to the database.');
    });

    // update the username in the database
    result = await new Promise((resolve, reject) => {
        db.run(
            'UPDATE users SET username = ? WHERE username = ?',
            newUsername,
            username,
            function (err) {
                if (err) reject(err);
                console.log(`User '${username}' changed to '${newUsername}' in database.`);
                result = true;
                resolve(result);
            }
        );
    });

    // Close the database
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Closed the database connection.');
    });
    return result;
}

async function changePassword(username, oldPassword, newPassword) {
    if (!await checkCredentials(username, oldPassword)) {
        return false;
    }
    let result = false;
    console.log(`changing password for user ${username}`);
    // Open the database
    const db = await new sqlite3.Database('server/users.db', (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Connected to the database.');
    });

    // update the password in the database
    result = await new Promise(async (resolve, reject) => {
        db.run(
            'UPDATE users SET password = ? WHERE username = ?',
            await hash(newPassword),
            username,
            function (err) {
                if (err) reject(err);
                console.log(`Password for user '${username}' changed in database.`);
                result = true;
                resolve(result);
            }
        );
    });

    // Close the database
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Closed the database connection.');
    });
    return result;
}

async function deleteUser(username) {
    let result;
    console.log(`deleting user ${username}`);
    // Open the database
    const db = await new sqlite3.Database('server/users.db', (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Connected to the database.');
    });

    // delete the user from the database
    result = await new Promise(async (resolve, reject) => {
        await db.run('DELETE FROM users WHERE username = ?', username, function (err) {
            if (err) reject(err);
            console.log(`User '${username}' deleted from database.`);
            resolve(true);
        });
    });

    // Close the database
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Closed the database connection.');
    });
    return result;
}

async function editUserRole(username, role) {
    let result = false;
    console.log(`Making ${username} ${role}`);
    // Open the database
    const db = await new sqlite3.Database('server/users.db', (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Connected to the database.');
    });

    // update the username in the database
    result = await new Promise((resolve, reject) => {
        db.run(
            'UPDATE users SET role = ? WHERE username = ?',
            role,
            username,
            function (err) {
                if (err) reject(err);
                console.log(`User '${username}' made ${role}`);
                result = true;
                resolve(result);
            }
        );
    });

    // Close the database
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Closed the database connection.');
    });
    return result;
}

module.exports.addUser = addUser;
module.exports.login = login;
module.exports.changeUsername = changeUsername;
module.exports.changePassword = changePassword;
module.exports.deleteUser = deleteUser;
module.exports.editUserRole = editUserRole;