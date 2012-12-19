/*
    WebChat Client v2 - replace WebChatClient
*/

var messagePoller; 
var chatClient = null;
var messagesWindow = '#chatMessageOutput';
var loginUser;

function webChatClient() { }
webChatClient.prototype =
{
	// Use version to identify is a new webChatClient
	version: 2,
	messageID: 0,
	messageUID: 0,
	clientChatDataID: 0, /* stores the id of the latest ChatData object received */
	webChatHandlerURL: "",
	userName: "",
	divChatWindowID: "chatMessageOutput",
	pollIntervalInSec: 5,
	chatClosedMessage: "The chat has been terminated. Good Bye.",
	customerLeaveChatMessage: "Customer has left the chat.",
	navigateToURLMessage: "",
	isClosed: false,
	contactUserID: 0,
	customerURL: null,
	pollRequestCount: 0,
	lastTyping: (new Date()).getTime(),
	lastTypingUser: null,
	_chatQuited: false, // whether customer has quit the chat
	_siteTimezoneUtcOffset: 0,
	chatConnected: false, // whether the chat be init
	lastConnected: true, // whether last connect is succeed, if fail, mean we need to refresh the messages

	startWebChat: function (userName, emailAddress, subject, initialCustomerQuestion, trackingSessionUID, trackingSessionOfferID) {

		var that = this;
		var queryStrings = this._toQueryParams(window.location.search);
		var defaultQueue = queryStrings['vq'];

		this.userName = userName;
		var postData = "userName=" + encodeURIComponent(this.userName) + "&subject=" + encodeURIComponent(subject);
		postData += "&emailAddress=" + encodeURIComponent(emailAddress) + "&action=i" + "&messageText=" + encodeURIComponent(initialCustomerQuestion);
		postData += "&trackingSessionUID=" + encodeURIComponent(trackingSessionUID);
		postData += "&trackingSessionOfferID=" + trackingSessionOfferID;

		if (defaultQueue)
			postData += '&vq=' + defaultQueue;

		this.customerURL = this.getWindowOpenerURL();
		if (this.customerURL)
			postData += "&customerURL=" + encodeURIComponent(this.customerURL)

		try {
			jQuery.ajax({
				type: "POST",
				url: this.webChatHandlerURL,
				data: postData,
				cache: false,
				success: function (response) {
					var jData = jQuery(response);
					var tempMessageUID = jData.find('MessageUID');
					var tempMsgID = jData.find('MessageID');
					if ((tempMessageUID.length > 0) && (tempMsgID.length > 0)) {
						loginUser = that.userName;
						that.messageID = tempMsgID.text();
						that.messageUID = tempMessageUID.text();
						// Initialise the chat - this will take the jQuery comet object, 
						// handshake with the server and then subscribe to the chat channel
						that.initListeners();

						that.addInfo('Connecting to the server ...');
						chat.init(jQuery.cometd, that.userName, that.messageID, that.contactUserID, that.messageUID, '../WebChatServer/comet.axd');
					}
					else
						alert('not ok: no UID or ID');
				},
				error: function (xhr, status, error) {
					alert('onException: ' + xhr.statusText);
				}
			});
			return false;
		}
		catch (err) {
			return false;
		}
	},

	initListeners: function (handshakeCallbackFunc, connectCallbackFunc) {
		var that = this;
		var _metaHandshake = function (message) {
			setTimeout(function () {
				that.checkForMessages();
				that.addInfo('Handshake ...');
			}, 1000);
		}

		var _metaConnect = function (message) {
			that.chatConnected = message.successful == true;
			if (that.chatConnected && !that.lastConnected) {
				that.checkForMessages();
				that.addInfo('Connected to the server');
			}
			that.lastConnected = that.chatConnected;
			if (!that.chatConnected && !that.isClosed) {				
				that.addInfo('Cannot connect to server due to network issue ...');
			}
		}

		//        var _metaUnsuccessful = function (message) {
		//            var msg = " failed: " + (message.error == undefined ? "No message" : message.error);
		//            that.addInfo(msg);
		//        }

		jQuery.cometd.addListener('/meta/connect', this, _metaConnect);
		if (handshakeCallbackFunc)
			jQuery.cometd.addListener('/meta/connect', this, handshakeCallbackFunc);
		jQuery.cometd.addListener('/meta/handshake', this, _metaHandshake);
		if (connectCallbackFunc)
			jQuery.cometd.addListener('/meta/handshake', this, connectCallbackFunc);
		//        jQuery.cometd.addListener('/meta/unsuccessful', this, _metaUnsuccessful);
	},



	sendLocalChat: function (message, userName) {
		var newline = this._formatMessage(message, '', userName, 0, new Date());
		this.addMessageLine(newline);
	},

	_toQueryParams: function (url) {
		var urlParams = {};
		var e,
		    a = /\+/g,  // Regex for replacing addition symbol with a space
		    r = /([^&;=]+)=?([^&;]*)/g,
		    d = function (s) { return decodeURIComponent(s.replace(a, " ")); },
		    q = url.substring(1);

		while (e = r.exec(q))
			urlParams[d(e[1])] = d(e[2]);

		return urlParams;
	},

	_formatTime: function (d) {
		var mins = d.getMinutes() + '';
		mins = mins.length > 1 ? mins : '0' + mins;
		return d.getHours() + ":" + mins;
	},

	// function to calculate local time
	_calcTime: function (d, offset) {

		// convert to msec
		// add local time zone offset 
		// get UTC time in msec
		utc = d.getTime() + (d.getTimezoneOffset() * 60000);

		// create new Date object for different time
		// using supplied offset
		nd = new Date(utc + (3600000 * offset));

		// return time
		return nd;
	},

	parseISO8601: function (str) {
		// we assume str is a UTC date ending in 'Z'

		var parts = str.split('T'),
	 dateParts = parts[0].split('-'),
	 timeParts = parts[1].split('Z'),
	 timeSubParts = timeParts[0].split(':'),
	 timeSecParts = timeSubParts[2].split('.'),
	 timeHours = Number(timeSubParts[0]),
	 _date = new Date;

		_date.setUTCFullYear(Number(dateParts[0]));
		_date.setUTCMonth(Number(dateParts[1]) - 1);
		_date.setUTCDate(Number(dateParts[2]));
		_date.setUTCHours(Number(timeHours));
		_date.setUTCMinutes(Number(timeSubParts[1]));
		_date.setUTCSeconds(Number(timeSecParts[0]));
		if (timeSecParts[1]) _date.setUTCMilliseconds(Number(timeSecParts[1]));

		return _date;
	},

	checkForMessages: function () {
		var postData = "action=c&messageID=" + encodeURIComponent(this.messageID) + "&clientChatDataID=0&contactUserID=" + this.contactUserID + "&messageUID=" + this.messageUID;
		var that = this;
		try {
			jQuery.ajax({
				type: "POST",
				url: this.webChatHandlerURL,
				data: postData,
				cache: false,
				success: function (response) {
					var jData = jQuery(response);

					var newLine = "";
					that.clearMessage();
					that._siteTimezoneUtcOffset = parseInt(jData.find('SiteTimezoneUtcOffset').text());
					var nodeList = jData.find("WebChatMessage").each(function () {
						var webChatMessage = $(this);
						var message = webChatMessage.find('MessageText').text();
						var url = webChatMessage.find("URL").text();
						var userName = webChatMessage.find("PostedBy").text();
						var contactUserID = parseInt(webChatMessage.find("ContactUserID").text());
						var created = webChatMessage.find("Created").text();
						// var time = created.substring(created.indexOf('T') + 1, created.indexOf('T') + 6);
						var time = that.parseISO8601(created);
						var pushurl = message ? null : url;

						newLine = newLine + chatClient._formatMessage(message, url, userName, contactUserID, time, pushurl);

					});


					if (jData.find("WebChatMessage").length > 0) {
						chatClient.addMessageLine(newLine);
					}

					if (jData.find('IsClosed').text().toLowerCase() == "true") {
						chatClient.isClosed = true;
						chatClient.addInfo(chatClient.chatClosedMessage);
						//Only show close message to client not agent.
						if (!chatClient.isAgent()) {
							chatClient.addInfo(chatClient.chatClosedMessage);
							chatClient.disableControls();
							// alert(chatClient.chatClosedMessage);
						}
						chat.leave();
					}

					if (jData.find('QuitByCustomer').text().toLowerCase() == "true" && chatClient.isAgent()) {
						chatClient.addInfo(chatClient.customerLeaveChatMessage);
						if (chatClient.chatConnected)
							chatClient.onCustomerQuit();
					}
				},
				error: function (xhr, status, error) {
					alert('onException: ' + xhr.statusText);
				}
			});
			return false;
		}
		catch (err) {
			return false;
		}

	},

	_formatInfo: function (message) {
		return '<span class="chatInfo">' + message + '<br/></span>';
	},

	// message: the chat messsage
	// url: cusomer opener url
	// userName: the userName
	// contactUserID: who sen the chat message. For customer, it should be 0
	// time: the datetime object
	// purshurl: the push url
	_formatMessage: function (message, url, userName, contactUserID, time, pushurl) {

		message = message.replace(/\n/g, '<br/>');
		var newLine = "";
		var cssClass;
		if (chatClient.isAgent()) {
			cssClass = chatClient.userName == userName || Number(contactUserID) != 0 ? "agentMessage" : "chatMessage";
		}
		else
			cssClass = chatClient.userName != userName ? "agentMessage" : "chatMessage";

		var userNamePart;

		var timeString;
		timeString = this.isAgent() ? this._formatTime(this._calcTime(time, this._siteTimezoneUtcOffset)) : this._formatTime(time);

		if (userName)
			userNamePart = "[" + timeString + "]&nbsp;<span class=\"chatUserName\">" + userName + ":&nbsp;</span>";
		else
			userNamePart = "[" + timeString + "]&nbsp;<span class=\"chatUserName\">" + "</span>";

		var messageTextPart = "<span class=\"" + cssClass + "\">" + message + "</span>";

		var urlPart = ""
		if (pushurl)
			urlPart = " [ <a href='" + pushurl + "' target='_blank'>" + pushurl + "</a> ]";

		var getCustomerUrlHtmlImageLink = function (url) {
			var imgUrl = rootUrl + 'img/web_search.gif'; // rootUrl found in formlib.js
			var html = "<img align='top' src='" + imgUrl + "' alt='" + url + "' onclick=\"window.open('" + url + "', '_blank')\" style='cursor:hand;'/>";
			return html;
		}

		if ((url == "") && !pushurl)
			newLine = newLine + userNamePart + messageTextPart + "<br>";
		else {
			if (pushurl) // URL sent by an agent
				newLine = newLine + userNamePart + messageTextPart + urlPart + "<br>";
			else if (message != "" && chatClient.isAgent()) // customer's url update for agent
				newLine = newLine + userNamePart + messageTextPart + " " + getCustomerUrlHtmlImageLink(url) + "<br>";
			else
				newLine = newLine + userNamePart + messageTextPart + "<br>";
		}

		return newLine;
	},

	addInfo: function (message) {
		jQuery('.chatInfo').remove();
		if (!jQuery.trim(message))
			return;

		var newline = this._formatInfo(message);
		var divChatWindowEl = document.getElementById(chatClient.divChatWindowID);
		divChatWindowEl.innerHTML = divChatWindowEl.innerHTML + newline;
		divChatWindowEl.scrollTop = divChatWindowEl.scrollHeight;
	},

	clearMessage: function () {
		var divChatWindowEl = document.getElementById(chatClient.divChatWindowID);
		divChatWindowEl.innerHTML = "";
	},

	addMessageLine: function (newline) {
		var divChatWindowEl = document.getElementById(chatClient.divChatWindowID);
		divChatWindowEl.innerHTML = divChatWindowEl.innerHTML + newline;
		divChatWindowEl.scrollTop = divChatWindowEl.scrollHeight;
	},

	sendChat: function (userName, messageText, custUrl) {
		messageText = jQuery.trim(messageText);
		if (messageText) {
			var channel = this.messageUID ? '/chat/' + this.messageUID : '/chat';
			if (custUrl)
				jQuery.cometd.publish(channel, { sender: this.userName, message: messageText },
                {
                	ext: {
                		extprop: {
                			exttype: "send",
                			extmsgid: this.messageID,
                			extcusturl: custUrl,
                			contactUserid: this.contactUserID ? this.contactUserID : 0
                		}
                	}
                });
			else
				jQuery.cometd.publish(channel, { sender: this.userName, message: messageText },
                {
                	ext: {
                		extprop: {
                			exttype: "send",
                			extmsgid: this.messageID,
                			contactUserid: this.contactUserID ? this.contactUserID : 0
                		}
                	}
                });
		}
	},

	closeChat: function () {
		if (this.isAgent()) {
			var channel = this.messageUID ? '/chat/' + this.messageUID : '/chat';
			jQuery.cometd.publish(channel, { sender: this.userName, message: this.chatClosedMessage },
                            {
                            	ext: {
                            		extprop: {
                            			exttype: "chatclosed",
                            			extmsgid: this.messageID,
                            			contactUserid: this.contactUserID ? this.contactUserID : 0
                            		}
                            	}
                            }
            );
			chat.leave(true);
		}
	},

	quitChat: function () {
		if ((chatClient.isClosed) || (this._chatQuited))
			return;

		//        var channel = this.messageUID ? '/chat/' + this.messageUID : '/chat';
		//        jQuery.cometd.publish(channel, { sender: 'System', message: this.userName + ' has left' });

		//		var postData = "action=q&messageID=" + encodeURIComponent(this.messageID) + "&messageUID=" + this.messageUID;
		//		try {
		//			jQuery.ajax({
		//				type: "POST",
		//				// async: false,
		//				url: this.webChatHandlerURL,
		//				data: postData,
		//				cache: false,
		//				success: function (response) {

		//				},
		//				error: function (xhr, status, error) {
		//					// alert('onException: ' + xhr.statusText);
		//				}
		//			});

		//		}
		//		catch (err) {

		//		}

		jQuery.cometd.async = false;
		try {
			var channel = this.messageUID ? '/chat/' + this.messageUID : '/chat';
			jQuery.cometd.publish(channel, { sender: this.userName, message: this.userName + ' has left' },
                {
                	ext: {
                		extprop: {
                			exttype: "quitchat",
                			extmsgid: this.messageID,
                			contactUserid: this.contactUserID ? this.contactUserID : 0
                		}
                	}
                }
            );
		}
		finally {
			jQuery.cometd.async = true;
		}

		chatClient.isClosed = true;
		this._chatQuited = true;
		// we must use synchronous to let window.unload wait the ajax calls finish
		chat.leave(true);
	},

	onCustomerQuit: function () {
		chatClient.closeChat();

		// try disabling the chat editor in CONTACT
		try {
			disableChatEditor();
		}
		catch (e) { }
	},

	onUserTyping: function () {
		var now = new Date();
		if (this.lastTyping + 5000 < now.getTime()) {
			var channel = this.messageUID ? '/chat/' + this.messageUID : '/chat';
			jQuery.cometd.publish(channel, { sender: this.userName, message: this.userName + ' is typing...' },
                            {
                            	ext: {
                            		extprop: {
                            			exttype: "typing",
                            			extmsgid: this.messageID
                            		}
                            	}
                            }
            );
			this.lastTyping = now.getTime();
		}
		// alert('Handler for .keydown() called.');        
	},

	disableControls: function () {
		jQuery('#chatMessageInput').attr('disabled', 'disabled');
		jQuery('#btnSend').attr('disabled', 'disabled');
	},

	getWindowOpenerURL: function () {
		var windowOpenerURL;
		try {
			if (window.opener != null)
				windowOpenerURL = window.opener.location.href.toString();
		}
		catch (e) {
			// Catch cross domain security exception 
		}
		return windowOpenerURL;
	},

	pushURLToCustomer: function (url) {
		if (this.isClosed) {
			this.closeChat();
			return;
		}
		else if (url == null || url == '')
			return;

		var channel = this.messageUID ? '/chat/' + this.messageUID : '/chat';

		jQuery.cometd.publish(channel, { sender: this.userName, message: "" },
            {
            	ext: {
            		extprop: {
            			exttype: "push",
            			extmsgid: this.messageID,
            			extcusturl: url,
            			contactUserid: this.contactUserID ? this.contactUserID : 0
            		}
            	}
            }
        );
	},

	isAgent: function () {
		return this.contactUserID > 0;
	}
}


function sendChat(tbChatLineID) {
    var tbChatLineEl = document.getElementById(tbChatLineID);
    var custUrl;
    var windowOpenerURL = chatClient.getWindowOpenerURL();

    if (!chatClient.isAgent() && windowOpenerURL != null && windowOpenerURL != chatClient.customerURL) {
        custUrl = windowOpenerURL;
        chatClient.customerURL = windowOpenerURL;
    }

    chatClient.sendChat(chatClient.userName, tbChatLineEl.value, custUrl);
    tbChatLineEl.value = "";
    tbChatLineEl.focus();
}

// Key comet handle incoming message
function handleIncomingMessage(comet) {
    if (chatClient && chatClient.isClosed)
        return;

    if ((comet.ext) && (comet.ext.extprop) && (comet.ext.extprop.exttype == 'typing')) {
        // typing ...
        if (comet.data.sender != chatClient.userName) {
            chatClient.lastTypingUser = comet.data.sender;
            chatClient.addInfo(comet.data.sender + ' is typing...');
            var now = new Date();
            lastTyping = now.getTime();
        }
        else
            chatClient.addInfo('');
        
    }
    else {
        var url = '';
        if ((comet.ext) && (comet.ext.extprop) && (comet.ext.extprop.exttype == 'leavechat')) {
            var getPathFromUrl = function(url) {
                return url.split("?")[0];
            }

            chatClient.addInfo(comet.data.message);
            if (parent.location)
                parent.document.location = getPathFromUrl(parent.location.href);
            return;
        }

        // Show agent join to the customer
        if ((comet.ext) && (comet.ext.extprop) && (comet.ext.extprop.exttype == 'agentjoin')) {
            if (chatClient && comet.data.sender && !chatClient.showedAgentJoin && !chatClient.isAgent() && (comet.data.sender != chatClient.userName)) {
                chatClient.showedAgentJoin = true;
                chatClient.addInfo(comet.data.message);
            }
            return;
        }

        // customer quit the chat, disable chat input control
        if ((comet.ext) && (comet.ext.extprop) && (comet.ext.extprop.exttype == 'quitchat')) {
        	jQuery('.chatControl').attr('disabled', 'disabled');
        	if (chatClient.contactUserID > 0 && !chatClient.isClosed) {
        		chatClient.addInfo(chatClient.customerLeaveChatMessage);
        		chat.leave();
                alert(chatClient.customerLeaveChatMessage);
            }
            return;  // Don't show this in the message window
        }
        // agent close the chat
        if ((comet.ext) && (comet.ext.extprop) && (comet.ext.extprop.exttype == 'chatclosed')) {
            chatClient.isClosed = true;
            chatClient.disableControls();
            chat.leave(true);

        	//Only show close message to client not agent.
        	if (!chatClient.isAgent()) {
        		chatClient.addInfo(comet.data.message);
        		alert(comet.data.message);
        	}
            return;
        }

        chatClient.lastTypingUser = null;

        if ((comet.ext) && (comet.ext.extprop) && (comet.ext.extprop.exttype == 'send')) // send message ...
        {
            url = comet.ext.extprop.extcusturl;
            if (!url)
                url = '';
        }

        var pushUrl;

        if ((comet.ext) && (comet.ext.extprop) && (comet.ext.extprop.exttype == 'push')) // push url ...
        {
            pushUrl = comet.ext.extprop.extcusturl;
        }

        // Don't show the system info which comet.data.sender is null
        if (comet.data.sender) { 
            var sender = (comet.data.sender || 'System');
            var remoteContactUserId = 0;
            if (comet.ext.extprop && comet.ext.extprop.contactUserid)
                remoteContactUserId = comet.ext.extprop.contactUserid;
            var newLine = chatClient._formatMessage(comet.data.message, url, sender, remoteContactUserId, new Date(), pushUrl);
            chatClient.addMessageLine(newLine);
            chatClient.addInfo('');
        }

        if (pushUrl &&  (pushUrl != "") && !chatClient.isAgent())
            takeCustomerToURL(pushUrl);
    }

    function takeCustomerToURL(url) {
        if (url == null || url == "")
            return;

        var msg = chatClient.navigateToURLMessage.replace(/\{0\}/, url);

        // push url confirm dialog
			jQuery("#pushUrlMessage").show();
            jQuery("#pushUrlMessage").text(msg);

            jQuery("#dialog-confirm").dialog({
                resizable: false,
                height: 140,
                modal: true,
                buttons: {
                    "Ok": function () {
                        jQuery(this).dialog("close");
                        try {
                            window.opener.navigate(url);
                        }
                        catch (e) {
                            window.open(url, '_blank');
                        }
                    },
                    Cancel: function () {
                        jQuery(this).dialog("close");
                    }
                }
            });

//        var navigateAway = confirm(msg);

//        if (navigateAway) {
//            try {
//                window.opener.navigate(url);
//            }
//            catch (e) {
//                window.open(url, '_blank');
//            }
//        }

    }
}

function chatLineOnKeyDown(tbChatLine, e) {
    var keynum;
    var keychar;
    var numcheck;

    if (window.event) // IE
        keynum = e.keyCode;
    else if (e.which) // Netscape/Firefox/Opera
        keynum = e.which;

    if ((keynum == 13) && (!e.shiftKey)) // 'return'
    {
        sendChat(tbChatLine.id);
        return false;
    }
}

var MessagePoller =
{
    checkForMessages: function () {

    }
}