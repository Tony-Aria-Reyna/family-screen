/* Family Screen — Alexa skill.  Paste this into the Code tab of your Alexa-hosted skill (index.js).
   It talks to one address: your family's own Google helper. Nothing else is exposed. */
const Alexa = require('ask-sdk-core');
const https = require('https');
const HELPER_URL = '__URL__';
const VOICE_KEY = '__KEY__';
const PEOPLE = __PEOPLE__;

function post(body) {
  return new Promise(function (resolve, reject) {
    const data = JSON.stringify(Object.assign({ key: VOICE_KEY }, body));
    const go = function (urlStr, payload, n) {
      const u = new URL(urlStr);
      const opts = { hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, method: payload ? 'POST' : 'GET', headers: {} };
      if (payload) { opts.headers['Content-Type'] = 'text/plain;charset=utf-8'; opts.headers['Content-Length'] = Buffer.byteLength(payload); }
      const req = https.request(opts, function (res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && n < 4) { res.resume(); return go(res.headers.location, null, n + 1); }
        let t = ''; res.setEncoding('utf8');
        res.on('data', function (c) { t += c; });
        res.on('end', function () { try { resolve(JSON.parse(t)); } catch (e) { reject(new Error('The helper sent back something I could not read.')); } });
      });
      req.on('error', reject);
      req.setTimeout(7500, function () { req.destroy(new Error('The helper took too long to answer.')); });
      if (payload) req.write(payload);
      req.end();
    };
    go(HELPER_URL, data, 0);
  });
}
const slot = function (h, name) { const v = Alexa.getSlotValue(h.requestEnvelope, name); return v ? String(v).trim() : ''; };
// Alexa passes a person id when it recognises the speaker's voice profile
const who = function (h) { const sys = (h.requestEnvelope.context || {}).System || {}; return (sys.person || {}).personId || ''; };
const asked = function (h, what) {
  const a = h.attributesManager.getSessionAttributes() || {};
  if (a['asked_' + what]) return true;
  a['asked_' + what] = 1; h.attributesManager.setSessionAttributes(a); return false;
};
const elicit = function (h, name, prompt) { return h.responseBuilder.speak(prompt).reprompt(prompt).addElicitSlotDirective(name).getResponse(); };
const answer = function (h, r) { return h.responseBuilder.speak(r.speech).withSimpleCard('Family Screen', r.speech).getResponse(); };
const run = function (h, body) { body.person_id = who(h); return post(body).then(function (r) { return answer(h, r.speech ? r : { speech: r.error === 'not allowed' ? 'The voice key does not match. Copy the skill code from the app again.' : 'Sorry, I could not reach the family screen.' }); }); };
const named = function (h) { const p = slot(h, 'person'); return p; };
const peopleList = PEOPLE.length < 2 ? '' : PEOPLE.slice(0, -1).join(', ') + ' or ' + PEOPLE[PEOPLE.length - 1];

const H = {};
H.Launch = {
  canHandle: function (h) { return Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest'; },
  handle: function (h) {
    const s = 'Hi. You can ask what is on today, where everyone is, what is for dinner, or what bills are due. You can also say, add milk to the shopping list, or, add a job.';
    return h.responseBuilder.speak(s).reprompt('What would you like to know?').getResponse();
  }
};
H.AddShop = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'AddShopIntent'; },
  handle: function (h) { const item = slot(h, 'item'); if (!item) return elicit(h, 'item', 'What should I add to the shopping list?'); return run(h, { action: 'shop_add', item: item }); }
};
H.ShopList = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'ShopListIntent'; },
  handle: function (h) { return run(h, { action: 'shop_list' }); }
};
H.AddJob = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'AddJobIntent'; },
  handle: function (h) {
    const task = slot(h, 'task'), person = named(h);
    if (!task) return elicit(h, 'task', 'What is the job?');
    if (!person && peopleList && !asked(h, 'person')) return elicit(h, 'person', 'Who is it for? ' + peopleList + '?');
    return run(h, { action: 'job_add', task: task, person: person, force: 1 });
  }
};
H.Jobs = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'JobsIntent'; },
  handle: function (h) { return run(h, { action: 'jobs', person: named(h) }); }
};
H.MyJobs = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'MyJobsIntent'; },
  handle: function (h) {
    const p = named(h);
    if (p) return run(h, { action: 'jobs', person: p });                      // they answered "who is this?"
    if (!who(h) && peopleList && !asked(h, 'person')) return elicit(h, 'person', 'I cannot tell whose voice this is. Who are you? ' + peopleList + '?');
    return run(h, { action: 'jobs', me: 1, person: p });
  }
};
H.Identify = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'IdentifyIntent'; },
  handle: function (h) { const p = named(h); if (!p) return elicit(h, 'person', 'Who are you? ' + peopleList + '?'); return run(h, { action: 'identify', person: p }); }
};
H.Jars = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'JarsIntent'; },
  handle: function (h) { return run(h, { action: 'jars', person: named(h) }); }
};
H.MyJars = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'MyJarsIntent'; },
  handle: function (h) {
    const p = named(h);
    if (p) return run(h, { action: 'jars', person: p });
    if (!who(h) && peopleList && !asked(h, 'person')) return elicit(h, 'person', 'I cannot tell whose voice this is. Who are you? ' + peopleList + '?');
    return run(h, { action: 'jars', me: 1 });
  }
};
H.AddEvent = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'AddEventIntent'; },
  handle: function (h) {
    const title = slot(h, 'title'), when = slot(h, 'when'), time = slot(h, 'time'), person = named(h);
    if (!title) return elicit(h, 'title', 'What should I put in the calendar?');
    if (!when && !asked(h, 'when')) return elicit(h, 'when', 'What day is that?');
    if (!time && !asked(h, 'time')) return elicit(h, 'time', 'What time? Say all day if there is no time.');
    if (!person && peopleList && !asked(h, 'person')) return elicit(h, 'person', 'Who is it for? ' + peopleList + '? Say everyone if it is for all of you.');
    const body = { action: 'event_add', title: title, date: when, time: time, person: /everyone|all of us|all/i.test(person) ? '' : person };
    const a = h.attributesManager.getSessionAttributes() || {}; a.pending = body; h.attributesManager.setSessionAttributes(a);
    const said = title + (when ? ', ' + (when === todayKey() ? 'today' : when === todayKey(1) ? 'tomorrow' : 'on ' + when) : '') + (time ? ' at ' + sayTime(time) : '') + (body.person ? ', for ' + body.person : '');
    return h.responseBuilder.speak(said + '. Shall I add that?').reprompt('Shall I add that? Say yes or no.').getResponse();
  }
};
const todayKey = function (plus) { const d = new Date(Date.now() + (plus || 0) * 864e5 + 13 * 36e5); return d.toISOString().slice(0, 10); };
const sayTime = function (t) { const p = String(t).split(':'), hh = +p[0]; return (hh % 12 || 12) + (p[1] === '00' ? '' : ':' + p[1]) + (hh < 12 ? ' in the morning' : hh < 18 ? ' in the afternoon' : ' in the evening'); };
H.Yes = {
  canHandle: function (h) { const a = h.attributesManager.getSessionAttributes() || {}; return Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.YesIntent' && !!a.pending; },
  handle: function (h) { const a = h.attributesManager.getSessionAttributes(); const body = a.pending; a.pending = null; h.attributesManager.setSessionAttributes(a); return run(h, body); }
};
H.No = {
  canHandle: function (h) { const a = h.attributesManager.getSessionAttributes() || {}; return Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.NoIntent' && !!a.pending; },
  handle: function (h) { const a = h.attributesManager.getSessionAttributes(); a.pending = null; h.attributesManager.setSessionAttributes(a); return h.responseBuilder.speak('Okay, I have left it out.').getResponse(); }
};
H.Agenda = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'AgendaIntent'; },
  handle: function (h) { return run(h, { action: 'agenda', date: slot(h, 'when') }); }
};
H.Where = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'WhereIntent'; },
  handle: function (h) { return run(h, { action: 'where', person: named(h) }); }
};
H.Bills = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'BillsIntent'; },
  handle: function (h) { return run(h, { action: 'bills' }); }
};
H.Renewals = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'RenewalsIntent'; },
  handle: function (h) { return run(h, { action: 'renewals' }); }
};
H.Meal = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'MealIntent'; },
  handle: function (h) { return run(h, { action: 'meal', date: slot(h, 'when') }); }
};
H.Remember = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'RememberIntent'; },
  handle: function (h) { const t = slot(h, 'text'); if (!t) return elicit(h, 'text', 'What should I remember?'); return run(h, { action: 'remember', text: t }); }
};
H.Ask = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'AskIntent'; },
  handle: function (h) { const q = slot(h, 'q'); if (!q) return elicit(h, 'q', 'What would you like to know?'); return run(h, { action: 'ask', q: q }); }
};
H.Help = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.HelpIntent'; },
  handle: function (h) {
    const s = 'Try: what is on today. Where is everyone. What is for dinner. What bills are due. What is coming up. What are my jobs. How much has everyone saved. Add milk to the shopping list. Add a job. Put something in the calendar. Remember that the bins go out on Tuesday. Or start with tell me, and ask anything about the family. If I do not know your voice, say, I am, and your name.';
    return h.responseBuilder.speak(s).reprompt('What would you like to know?').getResponse();
  }
};
H.Stop = {
  canHandle: function (h) { const n = Alexa.getIntentName(h.requestEnvelope); return Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && (n === 'AMAZON.StopIntent' || n === 'AMAZON.CancelIntent' || n === 'AMAZON.NavigateHomeIntent'); },
  handle: function (h) { return h.responseBuilder.speak('Okay.').getResponse(); }
};
H.Fallback = {
  canHandle: function (h) { return Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.FallbackIntent'; },
  handle: function (h) { return h.responseBuilder.speak('Sorry, I did not catch that. You can ask what is on today, or start with tell me and ask anything. Say help for more.').reprompt('What would you like to know?').getResponse(); }
};
H.YesNoIdle = {
  canHandle: function (h) { const n = Alexa.getIntentName(h.requestEnvelope); return n === 'AMAZON.YesIntent' || n === 'AMAZON.NoIntent'; },
  handle: function (h) { return h.responseBuilder.speak('Sorry, I am not sure what you are saying yes or no to. Say help to hear what I can do.').reprompt('What would you like to know?').getResponse(); }
};
H.SessionEnded = {
  canHandle: function (h) { return Alexa.getRequestType(h.requestEnvelope) === 'SessionEndedRequest'; },
  handle: function (h) { return h.responseBuilder.getResponse(); }
};
const ErrorHandler = {
  canHandle: function () { return true; },
  handle: function (h, error) {
    console.log('Error: ' + error.message);
    return h.responseBuilder.speak('Sorry, I could not reach the family screen just then. Please try again.').getResponse();
  }
};
exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(H.Yes, H.No, H.Launch, H.AddShop, H.ShopList, H.AddJob, H.MyJobs, H.Jobs, H.Identify, H.Jars, H.MyJars, H.AddEvent, H.Agenda, H.Where, H.Bills, H.Renewals, H.Meal, H.Remember, H.Ask, H.Help, H.Stop, H.YesNoIdle, H.Fallback, H.SessionEnded)
  .addErrorHandlers(ErrorHandler)
  .lambda();
