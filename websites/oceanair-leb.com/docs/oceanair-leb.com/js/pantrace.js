
function controlSelectorair()
{
    if (document.pantraceair.docref.options[document.pantraceair.docref.selectedIndex].value=="Title")
        document.pantraceair.docref.options[document.pantraceair.docref.selectedIndex+1].selected=true;
}

function clickedDemoButton()
{
    document.pantrace.clickedButton.value = "demo";
}

function clickedTrackButtonair()
{
    document.pantraceair.clickedButton.value = "track";
}

function checkPantraceair()
{
	
    var func = "";
    var type = "";
    var number = "";
    var status = 'true';
		
    if(status == 'true') {
    	
        //get Function, Type and Number
				if(document.pantraceair.clickedButton.value != "")
						func = document.pantraceair.clickedButton.value;
        if(document.pantraceair.docref.value != "")
            type = document.pantraceair.docref.value;
        if(document.pantraceair.number.value != "")
            number = document.pantraceair.number.value;
        
        
        	
        if(func != "" && type != "") {
        	
        	if(func == "demo") { //if function is demo open popup
            	showDemo(type);
        	
            } else if (type == "all") {
							 // validate (special case for type all)
               if(validateTypeAll(type, number)) {                
                    showWindowair(type, number);                       
                } else {
                    showError(type);                                
                }
			} else {
								// validate entries
                if(validateEntries(type, number)) { 
                    showWindowair(type, number);                       
                } else {
                    showError(type);                                
                }
            }
        }
    } else {
       showError('serverOffline');		
    }

    return false;
}

function showDemo(type)
{
    // Number-Array
    demoNumber = new Object();
    demoNumber.all = 'AIR999999';
    demoNumber.house = 'AIR999999';
    demoNumber.custref = 'DEMOPACAIR';
    demoNumber.pantainer = 'SEA999999';
    demoNumber.direct = '12312345678';
    demoNumber.continent = '123123456789';    
    
    // get demo number for type
    var dnumber = demoNumber[type];
    // show popup
   
    showWindow(type, dnumber)
}

function validateEntries(type, number)
{
    // Trim and to uppercase
    number = number.replace(/^\s*|\s*$/g,"");
    number = number.toUpperCase();
    
    
    
    // Choose Regex
    if(type == "house")
        {
        regex = /^[A-Z]{3}[0-9]{6}$/;
        }
    else if(type == "direct")
        {
        regex = /^\d{3}\-?\d{8}$/;
        }
    else if (type == "pantainer")
        {
        regex = /^[A-Z0-9]{1,15}$/;
        }    
    else if(type == "continent")
    	{
    	regex = /^[0-9]{11,13}$/;
    	}    
    else if(type == "custref")
        {
        regex = /^[a-zA-Z0-9\s_.:,\-#\/]{1,50}$/;
        }
    
    // Analyse the number
    if(regex.test(number))
        return true;

    return false;
}

function validateTypeAll(type, number)
{
	return validateEntries("house", number) 
		|| validateEntries("direct", number) 
		|| validateEntries("pantainer", number) 
		|| validateEntries("continent", number) 		
		|| validateEntries("custref", number);
}

function showError(type) 
{
    // Number-Array
    errors = new Object();
    errors.serverOffline = 'Pantrace currently not available, please try again later';
    errors.all = 'Error: Wrong number.\nPlease enter either an HAWB, Direct AWB, Pantainer B/L or Customer Reference number.';
    errors.house = 'Error: Wrong number.\nHAWB must be 3 alphanumeric followed by 6 digits.';
    errors.custref = 'Error: Wrong number.\nCustomer reference can be 50 char long maximum and contains invalid characters.';
    errors.pantainer = 'Error: Wrong number.\nBill of lading can be 15 char long maximum.';
    errors.continent = 'Error: Wrong number.\nOverland reference/UTN has to be a 11, 12 or 13-digit combination of numbers.';
    errors.direct = 'Error: Wrong number.\nAWB Number can be an 11-digit combination of numbers with an optional - at third position';
    

    // get error message for type
    var error = errors[type];
    alert(error);
}


function showWindowair(type, number) 
{
	var externalLink = document.pantraceair.externalUrl.value;
    var panLink = externalLink + escape(type) + '&reference=' + escape(number) + '&searchAtStart=1';
	var load = window.open(panLink,'','scrollbars=yes,menubar=no,height=500,width=640,resizable=yes,toolbar=no,location=no,status=no'); 
}

