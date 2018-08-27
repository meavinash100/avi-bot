var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
var restify = require('restify');
var https = require('https');
var querystring = require('querystring');


var inMemoryStorage = new builder.MemoryBotStorage();

var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function(){
    console.log('%s listening to %s', server.name, server.url); 
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

var luisAppId = 'e304d649-e991-4649-b47a-b35f23aa474c';
var luisSubscriptionKey = "c9a34398596043dc8d2c69603bbcfeee";
var luisApiHostName = process.env.LuisApiHostName || 'westus.api.cognitive.microsoft.com';
var luisModelUrl = 'https://' + luisApiHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisSubscriptionKey + '&verbose=true&timezoneOffset=0&q=';
var recognizer = new builder.LuisRecognizer(luisModelUrl);
recognizer.onEnabled((context, callback) => {
    if(context.dialogStack.length > 0){
        // check to see if we are in a conversation
        callback(null, false);
    } else {
        callback(null, true);
    }
});

server.post('/api/messages', connector.listen());

var bot = new builder.UniversalBot(connector, function (session, args) {
    session.send("Welcome to Rhombus...");
});

bot.set('storage', inMemoryStorage);
bot.recognizer(recognizer);

 // Create console connector for communicating with the Bot Framework Service
 //var connector = new builder.ConsoleConnector().listen();
 
//  var bot = new builder.UniversalBot(connector, [
//     function (session) {
//         session.beginDialog('greetings', session.userData.profile);
//     },
//     function (session, results) {
//         session.userData.profile = results.response;
//         session.beginDialog('rootMenu', session.userData.profile);
//     },
//     function (session, results) {
//         session.endConversation("See you later!");
//     }
//  ]).recognizer(recognizer)
//  .set('storage', inMemoryStorage);



 bot.dialog('greetings', [
    function(session, args, next){
        session.send('You reached the Greetings intent. You said \'%s\'.', session.message.text);
        session.send("Hi! I am Rhombus");
        builder.Prompts.text(session, 'What is you name?');
    },
    function(session, results, next){
        session.dialogData.name = results.response;
        session.send(`Hello ${results.response}!`);
        builder.Prompts.text(session, 'Please tell me your Rhombus user name');
    },
    function (session) {
        session.replaceDialog('rootMenu');
    }
 ]).triggerAction({
     matches: 'Greetings'
 });

 bot.dialog('rootMenu', [
     function (session, results) {
         console.log(results)
         //When using choice the result values are stored in results.response.entity
         // Result indexes are stored in results.response.index
         builder.Prompts.choice(session, "Here are a few things I can help you with:", 
         'Apply Leave|Submit Expense|Search KB|Talk to Rhombus|Quit', { listStyle: builder.ListStyle.button });
     },
     function (session, results) {
         switch (results.response.index) {
             case 0:
                 session.beginDialog('applyLeave');
                 break;
             case 1:
                 session.beginDialog('submitExpense');
                 break;
             case 2:
                 session.beginDialog('searchKB');
                 break;
            case 3:
                 session.beginDialog('languageService');
                 break;
             default:
                 session.endDialog();
                 break;
         }
     },
     function (session) {
         session.endDialog();
     }
 ]).reloadAction('showMenu', null, { matches: 'RootMenu' });

// Apply leave

bot.dialog('applyLeave', [
    function(session, args){
        session.send('You reached the applyLeave intent. You said \'%s\'.', session.message.text);
        session.send("Please share a few details in order for me to complete the process...");
        builder.Prompts.time(session, "Please provide the leave start date (e.g.: June 6): ");
    },
    function(session, args, results){
        session.dialogData.leaveStartDate = builder.EntityRecognizer.resolveTime([args.response]);
        builder.Prompts.number(session, "For how many days you will be away including the start date: ");
    },
    function(session, args, results){
        session.dialogData.noDays = args.response;
        builder.Prompts.confirm(session, `Are these details correct: <br/> Leave Start Date: ${session.dialogData.leaveStartDate} <br/> No of Days: ${session.dialogData.noDays}`);
    },
    function(session, args, results){
        if (args.response){
            var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.xml)
            .attachments([
                new builder.ThumbnailCard(session)
                .title(`Leave request submitted for ${session.dialogData.leaveStartDate} <br/> and for ${session.dialogData.noDays} days`)
                .images([
                    builder.CardImage.create(session, "https://media.glassdoor.com/sql/1338098/rolling-arrays-squarelogo-1499080938372.png")
                ])
                .subtitle("Leaves remaing for the cycle: 5")
                .tap(new builder.CardAction.openUrl(session, "http://www.rollingarrays.com/"))
            ]);
            session.send(msg);
            session.endDialog();
        } else {
            session.send("Sorry, after all I am just a bot...Let me try again");
            session.replaceDialog('rootMenu');
        }
    },
    function (session) {
        session.replaceDialog('rootMenu');
    }
]).triggerAction({
    matches: 'ApplyLeave'
});

// Submit Expense

bot.dialog('submitExpense', [
    function(session, args){
        session.send('You reached the submitExpense intent. You said \'%s\'.', session.message.text);
        session.send("Please share a few details in order for me to help you during the process...");
        builder.Prompts.choice(session, "Which **expense category** you would like to apply: ", expenseTypes, {listStyle: builder.ListStyle.button});
    },
    function(session, results){
        session.dialogData.expenseType = results.response.entity;
        builder.Prompts.text(session, "Please provide the **date of the expense**: ");
    },
    function(session, args, results){
        session.dialogData.expenseDate = args.response;
        builder.Prompts.number(session, "Please provide the **expense amount**: ");
    },
    function(session, args, results){
        session.dialogData.expenseAmount = args.response;
        builder.Prompts.confirm(session, `Are these details correct: 
        <br/> Expense Type: ${session.dialogData.expenseType} 
        <br/> Date of Expense: ${session.dialogData.expenseDate}
        <br/> Expense Amount: ${session.dialogData.expenseAmount}`);
    },
    function(session, args, results){
        if (args.response){
            var msg = new builder.Message(session)
            .textFormat(builder.TextFormat.xml)
            .attachments([
                new builder.HeroCard(session)
                .title(`Expense request for ${session.dialogData.expenseType} on ${session.dialogData.expenseDate} <br/>for amount ${session.dialogData.expenseAmount} submitted successfully!`)
                .subtitle("The request is send for approval")
                .text("You have submitted 5 requests this month for a total amount of 569 SGD.")
                .images([
                    builder.CardImage.create(session, "https://media.glassdoor.com/sql/1338098/rolling-arrays-squarelogo-1499080938372.png")
                ])
            ]);
            session.send(msg);
            session.endDialog();
        } else {
            session.send("Sorry, after all I am just a bot...Let me try again");
            session.replaceDialog('rootMenu');
        }
    },
    function (session) {
        session.replaceDialog('rootMenu');
    }
]).triggerAction({
    matches: 'ApplyExpense'
});

//Luis Service
bot.dialog('languageService', [
    function(session, args){
        builder.Prompts.text(session, "Welcome to Rhombus natural language service... Please key in your requests in day to day language...");
    },
    function(session, args, next){
        console.log("Query: " + args.response);
        var intent = builder.EntityRecognizer.findAllEntities(args.intent.entities);
        console.log("Intent: " + intent);
        //var range = builder.EntityRecognizer.findAllEntities(intent.entities, 'builtin.number');
        //console.log("Range: " + range);
        // var user_query = builder.EntityRecognizer.findEntity(args.intent.entities, 'query');
        // console.log(user_query);
        // if (!user_query){
        //     builder.Prompt.text(session, 'What do you want to do?');
        // } else {
        //     next({response: user_query.entity});
        // }
    },
]
);


 var expenseTypes = [
    "Flight Ticket",
    "Accomodation",
    "Entertainment",
    "Hospitality",
    "Others"
 ];

 bot.dialog('searchKB', [
    function(session, args, next){
        session.send('You reached the searchKB intent. You said \'%s\'.', session.message.text);
        // builder.EntityRecognizer.findEntity(args.intent.entities, 'query')
        session.send("Welcome to Rhombus FAQ System.");
        builder.Prompts.text(session, "What would you like to get information on?");
    },
    function(session, results){
        session.dialogData.faqquery = results.response;
        session.send(`Looking for information relevant to ${session.dialogData.faqquery}`);
        showFaqResults(session); 
        session.sendTyping()
    },
    function (session) {
        session.replaceDialog('rootMenu');
    }
    ]
).triggerAction({
    matches: 'Search'
});


var showFaqResults = (function (session) {
    var post_data = {question: session.message.text};
    post_data = JSON.stringify(post_data);
    var resData = "";
    var post_options = {
        host: 'avifaq.azurewebsites.net',
        path: '/qnamaker/knowledgebases/b55742aa-b120-43e3-a500-bdd931bd27d6/generateAnswer',
        port: 443,
        method: 'POST',
        headers : {
            'Authorization': 'EndpointKey ' + "76a9cbef-90ec-4501-9897-9d5c67819aa1",
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(post_data)
        }
    };

    var post_req = https.request(post_options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            resData += chunk;
        });
        res.on('error', function(e) {
            console.log('problem with request: ' + e.message);
        });
        res.on('end', function() {
            var accessibleData = JSON.parse(resData);
            console.log('Response Answer: ' + accessibleData["answers"][0]["answer"]);
            var card = {
                'contentType': 'application/vnd.microsoft.card.adaptive',
                'content': {
                    'type': 'AdaptiveCard',
                    'speak': "Information I can dig about" + session.message.text,
                    'body': [
                        {
                            "type": "TextBlock",
                            "text": accessibleData["answers"][0]["answer"],
                            "size": "large",
                            "isSubtle": true,
                            "wrap": true
                        }
                    ],
                    "actions": [
                        {
                            "type": "Action.OpenUrl",
                            "method": "POST",
                            "url": "https://google.com",
                            "title": "Got the Answer"
                            },
                        {
                            "type": "Action.OpenUrl",
                            "method": "POST",
                            "url": "https://gmail.com",
                            "title": "Send an email to HR"
                        }
                    ]
                }
            }
            var msg = new builder.Message(session).addAttachment(card);
            session.send(msg);
            resData = "";
        });
    });
    // post the data
    post_req.write(post_data);
    post_req.end();
});


bot.dialog('help', [
    function(session){
        session.send('You reached the Search intent. You said \'%s\'.', session.message.text);
        session.endDialog('After all I am just a simple bot...! I am pretty sure you can find a way.');
    }
    ]
).triggerAction({
    matches: /^help$/i
});

bot.dialog('noneDialog', [
    function(session){
        session.send('You reached the None intent. You said \'%s\'.', session.message.text);
        session.endDialog('Sorry I didnt quite understand that');
    }
    ]
).triggerAction({
    matches: 'None'
});