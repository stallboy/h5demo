#!/usr/bin/env python
#
# Copyright 2007 Google Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#         http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
import cgi
import datetime
import logging
import wsgiref.handlers


from google.appengine.ext import db
from google.appengine.api import users
from google.appengine.ext import webapp

class Greeting(db.Model):
    author = db.UserProperty()
    nick = db.StringProperty()
    content = db.StringProperty(multiline=True)
    date = db.DateTimeProperty(auto_now_add=True)


class MainPage(webapp.RequestHandler):
    def get(self):
        logging.info("guestbook mainpage");
        self.response.out.write('<html><body>')
        self.response.out.write("""
                    <form action="/guestbook/sign" method="post">
                        nick:<input name="nick" />
                        <div><textarea name="content" rows="3" cols="60"></textarea></div>
                        <div><input type="submit" value="Sign Guestbook"></div>
                    </form>
                    """)

        greetings = db.GqlQuery("SELECT * "
                                "FROM Greeting "
                                "ORDER BY date DESC LIMIT 10")

        for greeting in greetings:
            self.response.out.write('<i>%s</i> &nbsp' % greeting.date.strftime("%Y-%m-%d %H:%M"))
            if greeting.nick:
                self.response.out.write('<b>%s</b> wrote:' % cgi.escape(greeting.nick))
            else:
                self.response.out.write('anonymous wrote:')
            self.response.out.write('<blockquote>%s</blockquote>' %cgi.escape(greeting.content))

        self.response.out.write("""
                </body>
            </html>""")
        
class Guestbook(webapp.RequestHandler):
    def post(self):
        greeting = Greeting()

        #if users.get_current_user():
            #greeting.author = users.get_current_user()
        greeting.nick = self.request.get('nick')
        greeting.content = self.request.get('content')
        greeting.put()
        self.redirect('/guestbook')


application = webapp.WSGIApplication([
    ('/guestbook', MainPage),
    ('/guestbook/sign', Guestbook)
], debug=True)


def main():
    wsgiref.handlers.CGIHandler().run(application)

if __name__ == '__main__':
    main()

