// Sample JavaScript file with various issues for demonstration

const userName = 'john_doe';  // Should use const
const userAge = 25;           // Should use const
const isActive = true;        // Should use const

function getUserInfo() {
    console.log('Getting user info...');  // Should be removed in production

    const fullName = userName + ' (age: ' + userAge + ')';  // Could use template literals
    const shortName = fullName.substring(0, 10);              // substr is deprecated

    if (userAge == 25) {  // Should use strict equality
        console.log('User is 25 years old');
    }

    if (isActive != false) {  // Should use strict inequality
        return {
            name: shortName,
            age: userAge,
            active: isActive
        };
    }

    return null;
}

// Function that could be converted to arrow function
const simpleAdd = function (a, b) {
    return a + b;
};

// jQuery deprecated method (if jQuery is used)
// $(document).ready(function() {
//     $('.button').live('click', function() {
//         console.log('Button clicked');
//     });
// });

module.exports = {
    getUserInfo: getUserInfo,
    simpleAdd: simpleAdd
};