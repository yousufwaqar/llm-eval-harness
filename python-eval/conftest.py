# Present so pytest adds this directory to sys.path (prepend import mode),
# which lets the test module import the sibling modules (constraints, metric,
# models) without packaging. Intentionally empty.
