## Usage

How to use in tests?

```hcl
run "random" {
  module {
    source = "../../testing/random_generator"
  }
}

run "testacc_example" {
  variables {
    my_var = "foo-${run.random.string}-bar"
  }
}
```
