'use strict';

// dependencies
var AWS = require('aws-sdk');
var nodemailer = require('nodemailer');
var handlebars = require('handlebars');
var fs         = require('fs');

// get reference to S3 and SES client
var s3  = new AWS.S3();

// constants
var templateFolder = "templates";
var srcKeyRoot = "root-folder/";

// variables to configure html template to use

var templateType;
var templateSubject;

exports.handler = (event, context, callback) => {
    console.log("SendMail --- Version 1.0.1");

    var transporter = nodemailer.createTransport({ SES: new AWS.SES({ region: "us-east-1"})});
    var readHTMLFile = function(path, callback) {
            fs.readFile(path, {encoding: 'utf-8'}, function (err, html) {
                if (err) {
                    throw err;
                }else {
                    callback(null, html);
                }
            });
        };

    var arrayMessage = JSON.parse(event.Records[0].Sns.Message);
    //console.log("event:"+JSON.stringify(arrayMessage));
    var tipo_envio   = JSON.stringify(arrayMessage.tipoEnvio);
    tipo_envio       = tipo_envio.replace(/\"/g,"");

    configureTemplate(tipo_envio);
    templateType        = 'template.html'

    var srcBucket       = JSON.stringify(arrayMessage.bucket);
    srcBucket           = srcBucket.replace(/\"/g,"");
    var srcKey          = srcKeyRoot + JSON.stringify(arrayMessage.nomeArq);
    srcKey              = srcKey.replace(/\"/g,"");
    var templateHtml    = templateFolder + "/" + templateType;

    console.log("srcBucket:    "+srcBucket);
    console.log("srcKey:       "+srcKey);
    console.log("templateHtml: "+templateHtml);

     s3.getObject({
            Bucket: srcBucket,
            Key: srcKey
        }, function(err, data) {
            if (err) {
                console.log(err, err.stack);
                callback(err);
            } else {

                //Pode ser usado a partir de metadata de um arquivo postado no S3
                // ou dentro de uma mensagem SNS

                if(tipo_envio.toString().trim() === 'fromPdf') {
                  var emailDestino   = data.Metadata.email;
                }else{
                  var emailDestino   = JSON.stringify(arrayMessage.email);
                }

                var nome           = data.Metadata.nome_pessoa;
                var nome_arq       = JSON.stringify(arrayMessage.nomeArq);
                nome_arq           = nome_arq.replace(/\"/g,"");

                var email          = 'Autor <autor@gmail.com>';

                readHTMLFile(templateHtml, function(err, html) {
                    var template = handlebars.compile(html);
                    var replacements = {
                      mesreferencia: mes_referencia,
                      name: nome_associado
                    };
                    var htmlToSend = template(replacements);
                    var mailOptions = {
                        from:     email,
                        to:       emailDestino,
                        subject:  templateSubject,
                        html :    htmlToSend,
                        attachments: [
                          {
                              filename: nome_arq,
                              content: new Buffer(data.Body, 'base64' )
                          }
                       ]
                     };
                    transporter.sendMail(mailOptions, function (error, response) {
                        if (error) {
                            console.log(error);
                            callback(err);
                        }
                    });
                });

                console.log('************************************************************');
                console.log('*** Arquivo ' + nome_arq + ' enviada por email');
                console.log('************************************************************');
                callback(null, null);
            }
        });
};