run "testint_random_generator" {
  command = apply

  assert {
    condition     = length(random_string.this.result) != 0
    error_message = "random string was not assigned correctly"
  }

  assert {
    condition     = length(random_uuid.this.result) != 0
    error_message = "random uuid was not assigned correctly"
  }

  assert {
    condition     = length(random_password.this.result) != 0
    error_message = "random password was not assigned correctly"
  }
}
