#!/usr/bin/env python
#
import cgi
import wsgiref.handlers

from google.appengine.api import xmpp
from google.appengine.ext import webapp

class MainPage(webapp.RequestHandler):
  def get(self):
    jid = "chengxiaosan2@gmail.com"
    self.response.out.write('<html><body>')
    pre = xmpp.get_presence(jid)
    self.response.out.write("%s presence: %d<br>"%(jid, pre))
    self.response.out.write("""
          <form action="/talk/sign" method="post">
            jid:<input name="jid" ><br>
            <textarea name="msg" rows="2" cols="60"></textarea><br>
            <input type="submit" value="talk">
          </form>
          """)
    self.response.out.write("""
        </body>
      </html>""")
    
class Guestbook(webapp.RequestHandler):
  def post(self):

    #if users.get_current_user():
      #greeting.author = users.get_current_user()
    jid = self.request.get('jid')
    msg = self.request.get('msg')
    r = xmpp.send_message(jid, msg)
    self.response.out.write("send: %d"%r);
    #self.redirect('/talk')


application = webapp.WSGIApplication([
  ('/talk', MainPage),
  ('/talk/sign', Guestbook)
], debug=True)


def main():
  wsgiref.handlers.CGIHandler().run(application)


