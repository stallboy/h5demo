#!/usr/bin/python
#coding: utf-8 
#
"""
An interactive, stateful AJAX shell that runs Python code on the server.

Part of http://code.google.com/p/google-app-engine-samples/.

May be run as a standalone app or in an existing app as an admin-only handler.
Can be used for system administration tasks, as an interactive way to try out
APIs, or as a debugging aid during development.

The logging, os, sys, db, and users modules are imported automatically.

Interpreter state is stored in the datastore so that variables, function
definitions, and other values in the global and local namespaces can be used
across commands.
"""

html = """
<html>
<head>
<meta charset=utf-8" />
<title> Interactive Shell </title>
<script type="text/javascript" src="/shell/shell.js"></script>
<style type="text/css">
body {
    font-family: monospace;
    font-size: 12pt;
    color: #ccc;
    background-color: #100;
    margin: 0;
    padding: 0;
}

a img {border: 0;}

#bigstat, #statement, #output {
    background-color: #100;
    font-family: monospace;
    color: #ccc;
    font-size: 12pt;
    overflow-x: hidden;
}
#statement, #output{ border: 0;}
#bigstat {border: 1px solid #ccc; width:100%%}
.main{ width:100%%; height:100%% ; color: #ccc; font-family: monospace; }
#cmd { position: absolute; bottom: 5px; }
.main #cmd #statement{ width: 760px; border: 0; }
#output {height: 400px; width: 100%%;}

#ajax-status { font-weight: bold; }

.message {
    color: #8AD;
    font-weight: bold;
    font-style: italic;
}

.error {
    color: #F44;
}
</style>
</head>

<body>
<div class='main'>
<textarea id="output" readonly="readonly">
模拟IPython %s
<tab>补全, ?返回帮助, <esc>调出多行输入窗口
!clr    : 清屏
!exit   : 退出
!combine: 打印出所有语句
!big    : 多行输入窗口
</textarea>
<div id="ajax-status"></div>
<div id="bigstatement"></div>
<input type="hidden" id="session" value="%s" />
<div id='cmd'> <span id='prompt'> >>> </span> <input id="statement" /> </div>
</div>

<script>
document.getElementById('statement').focus();
document.getElementById('statement').addEventListener("keydown", shell.keyDown, false);
</script>

</body>
</html>
"""


import logging
import new
import os
import pickle
import sys
import traceback
import types
import StringIO
import wsgiref.handlers

from google.appengine.api import users
from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp import template
from django.utils import simplejson as json


# Set to True if stack traces should be shown in the browser, etc.
_DEBUG = True

# Types that can't be pickled.
UNPICKLABLE_TYPES = (
    types.ModuleType,
    types.TypeType,
    types.ClassType,
    types.FunctionType,
    )

# Unpicklable statements to seed new sessions with.
INITIAL_UNPICKLABLES = [
    'import logging',
    'import os',
    'import sys',
    'from google.appengine.ext import db',
    'from google.appengine.api import users',
    ]


class Session(db.Model):
    """A shell session. Stores the session's globals.
    Each session globals is stored in one of two places:
    If the global is picklable, it's stored in the parallel globals and
    global_names list properties. (They're parallel lists to work around the
    unfortunate fact that the datastore can't store dictionaries natively.)
    If the global is not picklable (e.g. modules, classes, and functions), or if
    it was created by the same statement that created an unpicklable global,
    it's not stored directly. Instead, the statement is stored in the
    unpicklables list property. On each request, before executing the current
    statement, the unpicklable statements are evaluated to recreate the
    unpicklable globals.
    Using Text instead of string is an optimization. We don't query on any of
    these properties, so they don't need to be indexed.
    """
    global_names = db.ListProperty(db.Text)
    globals = db.ListProperty(db.Blob)
    unpicklables = db.ListProperty(db.Text)
    statements = db.ListProperty(db.Text)

    def set_global(self, name, value):
        blob = db.Blob(pickle.dumps(value))
        if name in self.global_names:
            index = self.global_names.index(name)
            self.globals[index] = blob
        else:
            self.global_names.append(db.Text(name))
            self.globals.append(blob)
    def remove_global(self, name):
        if name in self.global_names:
            index = self.global_names.index(name)
            del self.global_names[index]
            del self.globals[index]
    def add_unpicklable(self, statement):
        self.unpicklables.append(db.Text(statement))
    def add_statement(self, statement):
        self.statements.append(db.Text(statement))
    def globals_dict(self):
        return dict((name, pickle.loads(val))
                                for name, val in zip(self.global_names, self.globals))


class FrontPageHandler(webapp.RequestHandler):
    """Creates a new session and renders the shell.html template.
    """
    def get(self):
        session_key = self.request.get('session')
        if session_key:
            session = Session.get(session_key)
        else:
            session = Session()
            session.unpicklables = [db.Text(line) for line in INITIAL_UNPICKLABLES]
            session_key = session.put()

        self.response.out.write(html%(sys.version.replace('\n', ' '), session_key))

def formatTips(tips):
    tipstr = ""
    tipc = len(tips)
    tips.sort()
    LINEMAX = 120
    if tips:
        ml  = max( [len(k) for k in tips] )  
        cols = max(LINEMAX / (ml+1), 1)
        rows = (tipc+cols-1) / cols

        cellfmt = '%%-%ds'%(LINEMAX/cols)
        for r in range(rows):
            n = r
            while True:
                if n+rows < tipc: 
                    tipstr += cellfmt%( tips[n] ) 
                else:
                    tipstr += tips[n] + '\n'
                    break
                n += rows
    else:
        tipstr = "..."

    return tipstr


class StatementHandler(webapp.RequestHandler):
    """Evaluates a python statement in a given session and returns the result.
    """
    def post(self):
        self.response.headers['Content-Type'] = 'text/plain'
        try:
            req = json.loads(self.request.body)
        except:
            logging.info("json parse err: " + self.request.body)
            self.response.out.write(traceback.format_exc())
            return
        logging.info(req)

        cmd = req[u'cmd'] 
        session = Session.get( req[u'session'] )
        combine = ( cmd == 'combine' )
        if combine:
            stats = [ s for s in session.statements ]
            self.response.out.write( ''.join(stats) )
            return

        statement = req[u'statement']
        statement = statement.strip()
        logging.info("statement:" + statement)
        if not statement:
            return
        
        helpme = ( statement[-1] == '?' )
        autocomplete = ( cmd == 'autocomplete' )
        if not autocomplete and not helpme:
            statement = statement.replace('\r\n', '\n')
            #logging.info('Compiling and evaluating:\n%s' % statement)
            mode = statement.find('\n') != -1 and 'exec' or 'single'
            statement += '\n\n'
            try:
                compiled = compile(statement, '<string>', mode)
            except:
                self.response.out.write(traceback.format_exc())
                return

        statement_module = new.module('__main__')
        # use this request's __builtin__, since it changes on each request.
        # this is needed for import statements, among other things.
        import __builtin__
        statement_module.__builtins__ = __builtin__


        # swap in our custom module for __main__. then unpickle the session
        # globals, run the statement, and re-pickle the session globals, all
        # inside it.
        old_main = sys.modules.get('__main__')
        try:
            sys.modules['__main__'] = statement_module
            statement_module.__name__ = '__main__'

            #重执行unpicklable statement时得把stdout, stderr设置为dummy，要不然都输出出去了
            olddict = statement_module.__dict__
            old_stdout = sys.stdout
            old_stderr = sys.stderr
            try:
                dummy = StringIO.StringIO()
                sys.stdout = dummy
                sys.stderr = dummy 
                for code in session.unpicklables:
                    exec code in statement_module.__dict__
            finally:
                sys.stdout = old_stdout
                sys.stderr = old_stderr
            #把执行后的新的unpicklable对象绑定到模块中, 
            unpickle = {}
            for k,v in statement_module.__dict__.items():
                if isinstance(v, UNPICKLABLE_TYPES) and ( (k not in olddict) or v != olddict[k] ) :
                    unpickle[k] = v 
            for k,v in unpickle.items():
                statement_module.__dict__[k] = v

            #pickblable对象会在global中绑定
            for k,v in session.globals_dict().items():
                statement_module.__dict__[k] = v

            old_globals = dict(statement_module.__dict__)
            #<tab>自动完成
            if autocomplete:
                nms = statement.split('.')
                if '' in nms[:-1]:
                    self.response.out.write("...");
                    return
                if len(nms) == 1:
                    tips = [ k for k in old_globals if k.startswith(statement) ]
                    tipstr = formatTips(tips)
                else:
                    nm = '.'.join(nms[:-1])
                    try:
                        tips = [ nm+"."+k for k in eval("dir(%s)"%nm, old_globals) if k.startswith(nms[-1]) ]
                        tipstr = formatTips(tips)
                    except:
                        tipstr = "dir %s error"%nm;
                        logging.info(tipstr)
                self.response.out.write(tipstr)
                return

            #?打印帮助
            if helpme:
                statement = statement[:-1]
                if statement[-1] == '?':
                    statement = statement[:-1]
                try:
                    tp = eval("type(%s)"%statement, old_globals)
                    doc = eval("%s.__doc__"%statement, old_globals)
                except:
                    tipstr = "type or doc %s error"%statement
                    logging.info(tipstr)
                    self.response.out.write(tipstr)
                    return
                try:
                    fname = eval("%s.__file__"%statement, old_globals)
                except:
                    fname = ""
                tipstr  = "type : %s\n"%tp
                if fname:
                    tipstr += "file : %s\n"%fname
                tipstr += "doc  : %s\n"%doc
                self.response.out.write(tipstr)
                return

            #执行
            try:
                old_stdout = sys.stdout
                old_stderr = sys.stderr
                try:
                    sys.stdout = self.response.out
                    sys.stderr = self.response.out
                    exec compiled in statement_module.__dict__
                    session.add_statement(statement)
                finally:
                    sys.stdout = old_stdout
                    sys.stderr = old_stderr
            except:
                self.response.out.write(traceback.format_exc())
                return

            #删除绑定
            for name, val in old_globals.items() :
                if name not in statement_module.__dict__:
                    session.remove_global(name)

            #加入新的绑定
            new_globals = {}
            for name, val in statement_module.__dict__.items():
                if name not in old_globals or val != old_globals[name]:
                    new_globals[name] = val
            if True in [isinstance(val, UNPICKLABLE_TYPES) for val in new_globals.values()]:
                session.add_unpicklable(statement)
                logging.debug('unpicklable: %s'%statement)
            for name, val in new_globals.items():
                if not name.startswith('__') and not isinstance(val, UNPICKLABLE_TYPES):
                    session.set_global(name, val)

        finally:
            sys.modules['__main__'] = old_main

        session.put()

application = webapp.WSGIApplication(
        [('/shell', FrontPageHandler),
         ('/shell.do', StatementHandler)], debug=_DEBUG)

def main():
    wsgiref.handlers.CGIHandler().run(application)

if __name__ == '__main__':
    main()
