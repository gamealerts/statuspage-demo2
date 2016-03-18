var systemLabelColor = "171717";
var severityLabels = {
    "1192FC": "investigating",
    "FFA500": "degraded performance",
    "FF4D4D": "major outage"
};

function render() {

    var endpoints = {
        "issues": "https://api.github.com/repos/" + config.repo + "/issues?state=all",
        "labels": "https://api.github.com/repos/" + config.repo + "/labels"
    };

    // show an indicator that we are doing something
    $("#load-indicator").show();

    var labels = request(endpoints.labels, render);
    if (labels == undefined) {
        return
    }

    var issues = request(endpoints.issues, render);
    if (issues == undefined) {
        return
    }

    var systems = [];

    labels.forEach(function (label) {
        if (label.color == systemLabelColor) {
            systems.push({"name": label.name, "status": "operational"});
        }
    });

    systems = systems.sort(function(a, b){
       return a.name.localeCompare(b.name);
    });

    var incidents = [];
    issues.forEach(function (issue) {
        issue.severity = "";
        issue.affectedSystems = [];
        issue.updates = [];
        issue.labels.forEach(function (label) {
            if (severityLabels[label.color] != undefined) {
                issue.severity = severityLabels[label.color];
            } else if (label.color == systemLabelColor) {
                issue.affectedSystems.push(label.name);
            }
        });

        if(issue.affectedSystems.length == 0 || issue.severity == undefined){
            return
        }

        //# make sure that the user that created the issue is a collaborator
        //if issue.user.login not in collaborators:
        //    continue

        if (issue.state == "open") {
            issue.affectedSystems.forEach(function (affectedSystem) {
                systems.forEach(function(system){
                   if(system.name == affectedSystem){
                       system.status = issue.severity;
                   }
                });
            });
        }else{
            issue.severity = "resolved";
        }

        incidents.push(issue);
    });

    // # sort incidents by date
    // incidents = sorted(incidents, key=lambda i: i["created"], reverse=True)

    // populate the panels
    var panels = [];
    systems.forEach(function(system){
       if(system.status != "operational"){
           var hasPanel = false;
           panels.forEach(function(panel){
               if(panel.status == system.status){
                   hasPanel = true;
                   panel.systems.push(system.name);
               }
           });
           if(!hasPanel){
               panels.push({"status": system.status, "systems": [system.name]})
           }
       }
    });

    // render the template
    var template = $('#template').html();
    Mustache.parse(template);
    var rendered = Mustache.render(template, {"systems": systems, "incidents": incidents, "panels": panels});
    $(main).html(rendered);

    setTimeout(function(){$("#load-indicator").hide()}, 1000);
}

function request(endpoint, callback) {
    console.log("get " + endpoint);
    callback = callback || false;
    var cached = Lockr.get(endpoint);
    $.ajax({
        url: endpoint,
        beforeSend: function (request) {
            if (cached != null && cached.etag != null) {
                request.setRequestHeader("If-None-Match", cached.etag);
            }
        },

        success: function (data, textStatus, request) {
            console.log(request.getResponseHeader('X-RateLimit-Remaining'));
            if (request.status == 304) {

            } else {
                Lockr.set(endpoint, {"data": data, "etag": request.getResponseHeader('ETag')});
                if (callback) {
                    callback();
                }
            }
        },
        error: function (request, textStatus, errorThrown) {
            console.log(request.getResponseHeader('X-RateLimit-Remaining'));
        }
    });
    return (cached) ? cached.data : undefined;
}