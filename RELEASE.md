# Making a new release of jupysql-plugin

Create conda environment:

```bash
conda env create  -f environment.yml -y
```

Bump the version using `hatch`. See the docs on [hatch-nodejs-version](https://github.com/agoose77/hatch-nodejs-version#semver) for details.
Sygnia fork - Note that we are using a completly different version (5.4.X) than what is published in the original one (0.4.X), to keep the same
name of package but make sure we are getting the fork from the private PyPI and not the original package.

```bash
NEW_VERSION='NEW_VERSION'
hatch version $NEW_VERSION
git add --all
git commit -m "Version $NEW_VERSION"
```

The previous command will update the version in the `package.json` file. You have to manually commit and create the tag:

```bash
git tag -a $NEW_VERSION -m "Version $NEW_VERSION"
git push
git push --tag
```

To create a Python source package (`.tar.gz`) and the binary package (`.whl`) in the `dist/` directory, do:

*Note:* The following command needs NodeJS:


```bash
# clean files before building
rm -rf dist
jlpm clean:all

# build the package
python -m build
```

Then to upload the package to PyPI, do:

```bash
twine upload dist/*
```

Sygnia fork - authenticate to twine by adding `-u build -p <token>` to the command