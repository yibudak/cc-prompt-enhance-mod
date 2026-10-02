import unittest

from app.users import create_user


class TestUsers(unittest.TestCase):
    def test_create_user(self):
        user = create_user({"name": "Ada", "email": "ada@example.com"})
        self.assertEqual(user["email"], "ada@example.com")
