/*
WebChat Client UI v2 - used with WebChatClient/Default.aspx
*/

jQuery(document).ready(function () {

	// Ensure we disconnect appropriately
	jQuery(window).unload(function () {
		if (chatClient != null)
			chatClient.quitChat();
	});

	jQuery('#btnStartChat').click(function () {
		if (Page_ClientValidate())
			startChat();
		return false;
	});

	jQuery('#btnQuit').click(function () {
		if (quitChat()) {
			jQuery('#chatStartPanel').hide();
			jQuery('#chatEditorPanel').hide();
			window.close();
		}
		return false;
	});

	jQuery('#chatEditorForm').submit(function () {
		sendChat('chatMessageInput');
		return false;
	});

	jQuery('#btnSend').submit(function () {
		sendChat('chatMessageInput');		
		jQuery('#chatMessageInput').focus();
		return false;
	});

	// User is typing
	jQuery('#chatMessageInput').keydown(function (event) {
		if ((this.value) && (chatClient)) {
			chatClient.onUserTyping();
		}

		if ((event.keyCode == 13) && (!event.shiftKey)) {
			event.preventDefault();
			sendChat('chatMessageInput');
		}
	});

	setInterval(function () {
		// Update typing info every 10 seconds
		if ((chatClient) && (chatClient.lastTypingUser)) {
			chatClient.addInfo(chatClient.lastTypingUser + ' entered text.');
			chatClient.lastTypingUser = null;
		}
	}, 10000);	
});

function startChat() {
	jQuery('#chatStartPanel').hide();
    jQuery('#chatEditorPanel').show();
    jQuery('#chatMessageInput').val('');
    adjustHeights();

    if (chatClient == null)
        chatClient = new webChatClient();

    chatClient.webChatHandlerURL = jQuery('#hdnWebChatHandlerUrl').val();
    chatClient.chatClosedMessage = jQuery('#hdnWebChatClosedMessage').val();
    chatClient.navigateToURLMessage = jQuery('#hdnNavigateToURLMessage').val();

    chatClient.startWebChat(jQuery('#username').val(), jQuery('#useremail').val(), jQuery('#ddlSubject').val(), jQuery('#userquestion').val(), jQuery('#hdnTrackingSessionUID').val(), jQuery('#hdnTrackingSessionOfferID').val());
}

function quitChat() {
    if (chatClient == null)
        return true;

    if (chatClient.isClosed)
        return true;

	var message = jQuery('#hdnConfirmQuitMessage').val();
	
    if (message != null && message != "")
    	message = jQuery('<div/>').html(message).text(); 
    else
        message = 'Are you sure?';
    
    if (confirm(message)) {
        if (chatClient != null)
            chatClient.quitChat();                
        return true;
    }
    return false;
}

// Layout control
function adjustHeights() {
	if (jQuery('#chatEditorPanel').css('display') != "none") {
    	var headerHeight = jQuery('#header').height();
        var footerHeight = jQuery('#footer').height();
        var pageHeight = jQuery(window).height();
        var panelHeight = jQuery('#chatEditorPanel').height();
        var chatMessageInput = jQuery('#chatMessageInput').height();
        var dialogConfirm = jQuery('#dialog-confirm').height();
        var mHeight = pageHeight - panelHeight - headerHeight - footerHeight - dialogConfirm - 95;         
        jQuery('#chatMessageOutput').height(mHeight);
    }
}

